#!/usr/bin/env node
// DawaDaam ↔ Gemma 4 bridge. Zero dependencies: Node ≥18 + a local Ollama.
//
// Gemma is given exactly two narrow jobs, and is never the authority on any drug fact:
//   POST /read  {image}              → {lines: string[]}  transcribe printed text on a strip/box
//   POST /pick  {lines, candidates}  → {id: string|null}  choose ONE id from OUR candidate list, or null
// Everything the patient sees (molecule, strength, prices) comes from the app's bundled data,
// and the patient confirms the pick. Structured output (JSON schema with an enum) makes it
// impossible for /pick to return an id we did not offer.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8000);
const OLLAMA = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const MODEL = process.env.GEMMA_MODEL ?? 'gemma4:e2b';
const MAX_BODY = 6 * 1024 * 1024;

export const READ_PROMPT =
  'You transcribe printed text from a photo of a medicine strip or box. ' +
  'Return every line of printed text exactly as printed, top to bottom: brand name, composition, strength. ' +
  'Do not add, correct, translate, explain or guess anything. If nothing is readable, return an empty list.';

export function pickPrompt(lines, candidates) {
  return [
    'Text read from a medicine package:',
    ...lines.map((l) => `- ${l}`),
    '',
    'Candidate products from our database:',
    ...candidates.map((c) => `- id=${c.id}: ${c.name} (${c.composition})`),
    '',
    'Which candidate is the product printed on the package? The brand name and strength must agree with the text.',
    'If none clearly matches, or you are unsure, answer null.',
  ].join('\n');
}

async function ollamaChat(messages, format) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, format, messages, options: { temperature: 0, num_ctx: 8192 } }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return JSON.parse(j.message?.content ?? '{}');
}

export async function readStrip(imageBase64) {
  const out = await ollamaChat(
    [{ role: 'user', content: READ_PROMPT, images: [imageBase64] }],
    { type: 'object', properties: { lines: { type: 'array', items: { type: 'string' } } }, required: ['lines'] },
  );
  return (Array.isArray(out.lines) ? out.lines : []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 30);
}

export async function pickCandidate(lines, candidates) {
  const ids = candidates.map((c) => String(c.id));
  const out = await ollamaChat(
    [{ role: 'user', content: pickPrompt(lines, candidates) }],
    { type: 'object', properties: { id: { enum: [...ids, null] } }, required: ['id'] },
  );
  // Belt and braces: only ever return an id we offered.
  return ids.includes(out.id) ? out.id : null;
}

function send(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // lets the public GitHub Pages site call this bridge on the user's own laptop (Chrome local-network access)
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('image too large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').replace(/^\/gemma/, '').split('?')[0];
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET' && path === '/health') {
      const tags = await (await fetch(`${OLLAMA}/api/tags`)).json();
      const ok = (tags.models ?? []).some((m) => m.name === MODEL || m.model === MODEL);
      return send(res, ok ? 200 : 503, { ok, model: MODEL, hint: ok ? undefined : `run: ollama pull ${MODEL}` });
    }
    if (req.method === 'POST' && path === '/read') {
      const { image } = await body(req);
      if (typeof image !== 'string' || image.length < 100) return send(res, 400, { error: 'image (base64 JPEG) required' });
      const t0 = Date.now();
      const lines = await readStrip(image);
      console.log(`[read] ${lines.length} lines in ${Date.now() - t0} ms: ${lines.slice(0, 3).join(' | ')}`);
      return send(res, 200, { lines });
    }
    if (req.method === 'POST' && path === '/pick') {
      const { lines, candidates } = await body(req);
      if (!Array.isArray(lines) || !Array.isArray(candidates) || !candidates.length) return send(res, 400, { error: 'lines and candidates required' });
      const id = await pickCandidate(lines.map(String).slice(0, 30), candidates.slice(0, 8));
      console.log(`[pick] → ${id}`);
      return send(res, 200, { id });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    send(res, e.status ?? 502, { error: String(e.message ?? e) });
  }
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  server.listen(PORT, () => console.log(`Gemma bridge on http://localhost:${PORT} → ${OLLAMA} (${MODEL})`));
}
