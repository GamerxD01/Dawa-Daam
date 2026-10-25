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
// Optional, off by default: handwritten prescriptions via Google Gemini (cloud). Only if the laptop owner sets a key.
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
// Tried in order when a model is busy or not available to this key. Set GEMINI_MODELS=a,b,c to fix the list;
// otherwise the backups are discovered at start-up from the models this key can see (Flash / Flash-Lite only).
const FIXED_MODELS = process.env.GEMINI_MODELS ? process.env.GEMINI_MODELS.split(',').map((m) => m.trim()).filter(Boolean) : null;
let GEMINI_MODELS = FIXED_MODELS ?? [GEMINI_MODEL];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const READ_PROMPT =
  'You transcribe printed text from a photo of a medicine strip, a medicine box or a printed prescription. ' +
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

export const HANDWRITING_PROMPT =
  'This is a photo of a doctor\'s handwritten prescription. List ONLY the medicines that are prescribed, one item per medicine, ' +
  'each as written: the form if written (Tab, Cap, Syp, Inj), the medicine name and its strength (e.g. "Cap Cyclomune 50mg", ' +
  '"Tab Nypid 10"). If the strength is written on the next line, join it to that medicine. ' +
  'Do NOT include the patient\'s name, age, sex, date, diagnosis, doctor or clinic details, advice, or dosage timings ' +
  '(1-0-1, morning, night, after food, सुबह, शाम, number of days). ' +
  'Copy spellings exactly as written: do not correct them, do not expand abbreviations, and never add a medicine that is not clearly written. ' +
  'If a word is unreadable, write [?] in its place instead of guessing. Do not give any advice.';

export const GEMINI_STRIP_PROMPT =
  'You transcribe printed text from a photo of a medicine strip, box or printed prescription. Return every line of printed ' +
  'text exactly as printed, top to bottom: brand name, composition, strength. Do not add, correct, translate, explain or guess. ' +
  'If a word is unreadable, write [?] in its place.';

/** Handwriting, via Gemini. Same contract as readStrip: lines of text, never drug facts. */
export async function readHandwritten(imageBase64) {
  return readWithGemini(imageBase64, HANDWRITING_PROMPT, 'medicines');
}

/** Fallback for strips/boxes when the local Gemma read found nothing we can match. */
export async function readStripWithGemini(imageBase64) {
  return readWithGemini(imageBase64, GEMINI_STRIP_PROMPT);
}

async function readWithGemini(imageBase64, prompt, field = 'lines') {
  if (!GEMINI_KEY) throw Object.assign(new Error('Gemini is not enabled (no GEMINI_API_KEY)'), { status: 501 });
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { [field]: { type: 'ARRAY', items: { type: 'STRING' } } }, required: [field] },
    },
  });
  const failures = [];
  for (const model of usableModels()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await geminiCall(model, body);
      if (r.ok) {
        const j = await r.json();
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '{}';
        const items = JSON.parse(text)[field];
        if (model !== GEMINI_MODELS[0] || attempt > 0) console.log(`[gemini] answered by ${model} (attempt ${attempt + 1})`);
        return (Array.isArray(items) ? items : []).map(String).map((l) => l.trim()).filter(Boolean).slice(0, 30);
      }
      const kind = classifyGeminiError(r.status, await r.text());
      if (kind.type === 'bad-key') throw Object.assign(new Error(`Gemini key rejected: ${kind.detail}`), { status: 502 });
      if (kind.type === 'busy' && attempt < 2) {
        console.log(`[gemini] ${model} busy (${r.status}), retrying…`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (kind.type === 'not-allowed') blocked.add(model); // never try it again this run
      console.log(`[gemini] ${model}: ${kind.detail}, trying next model…`);
      failures.push(`${model}: ${kind.detail}`);
      break;
    }
  }
  throw Object.assign(new Error(failures.length ? failures.join('; ') : 'no Gemini model available for this key'), { status: 503 });
}

// Models this key turned out not to be allowed to use (e.g. "limit: 0" on the free tier). Skipped from then on.
const blocked = new Set();
const usableModels = () => GEMINI_MODELS.filter((m) => !blocked.has(m));

function geminiCall(model, body) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body,
  });
}

/**
 * Sort a Gemini error into what to do next:
 *  bad-key     → stop, no model will work (invalid / expired key)
 *  not-allowed → this model is not available to this key (free tier "limit: 0", permission, not found): skip it for good
 *  busy        → overloaded or a short rate limit: retry, then try the next model
 *  other       → this model refused this request: try the next model
 */
export function classifyGeminiError(status, text) {
  const t = String(text ?? '');
  const msg = (() => { try { return JSON.parse(t).error?.message ?? t; } catch { return t; } })().replace(/\s+/g, ' ').slice(0, 160);
  if (status === 401 || /API_KEY_INVALID|API key not valid|API key expired/i.test(t)) return { type: 'bad-key', detail: msg };
  if (status === 404 || status === 403) return { type: 'not-allowed', detail: `not available to this key (${status})` };
  if (status === 429 && /limit:\s*0\b|free[ _-]?tier|not available|billing/i.test(t)) return { type: 'not-allowed', detail: 'not available on this key\'s plan (free tier)' };
  if (status === 429 || status >= 500) return { type: 'busy', detail: `busy (${status})` };
  if (/free[ _-]?tier|billing|paid/i.test(t)) return { type: 'not-allowed', detail: 'not available on this key\'s plan' };
  return { type: 'other', detail: `${status}: ${msg}` };
}

/** Text-capable Flash / Flash-Lite models from Google's model list, newest version first. */
export function pickBackupModels(list, primary) {
  const version = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) ?? [])[1] ?? 0);
  const names = (list ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => String(m.name ?? '').replace(/^models\//, ''))
    .filter((n) => /^gemini-[\d.]+-flash(-lite)?(-latest|-\d{3})?$/.test(n) && n !== primary);
  names.sort((a, b) => version(b) - version(a) || (a.includes('lite') ? 1 : 0) - (b.includes('lite') ? 1 : 0));
  return [primary, ...names].slice(0, 4);
}

async function discoverGeminiModels() {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GEMINI_KEY } });
    if (r.ok) GEMINI_MODELS = pickBackupModels((await r.json()).models, GEMINI_MODEL);
  } catch { /* offline: keep the primary only */ }
}

/** At start-up, ask each model for one token so we know straight away which ones this key can use. */
async function probeGeminiModels() {
  if (!FIXED_MODELS) await discoverGeminiModels();
  console.log(`Gemini models to try: ${GEMINI_MODELS.join(' → ')}`);
  const body = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }], generationConfig: { maxOutputTokens: 1 } });
  for (const model of GEMINI_MODELS) {
    try {
      const r = await geminiCall(model, body);
      if (r.ok) { console.log(`  ✓ ${model}`); continue; }
      const kind = classifyGeminiError(r.status, await r.text());
      if (kind.type === 'not-allowed') blocked.add(model);
      console.log(`  ${kind.type === 'busy' ? '~' : '✗'} ${model}: ${kind.detail}`);
      if (kind.type === 'bad-key') return;
    } catch (e) {
      console.log(`  ? ${model}: ${e.message}`);
    }
  }
  if (!usableModels().length) console.log('  No Gemini model is usable with this key. Set GEMINI_MODELS to one your key allows (see https://aistudio.google.com).');
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
      return send(res, ok ? 200 : 503, { ok, model: MODEL, handwriting: Boolean(GEMINI_KEY), hint: ok ? undefined : `run: ollama pull ${MODEL}` });
    }
    if (req.method === 'POST' && path === '/read') {
      const { image } = await body(req);
      if (typeof image !== 'string' || image.length < 100) return send(res, 400, { error: 'image (base64 JPEG) required' });
      const t0 = Date.now();
      const lines = await readStrip(image);
      console.log(`[read] ${lines.length} lines in ${Date.now() - t0} ms: ${lines.slice(0, 3).join(' | ')}`);
      return send(res, 200, { lines });
    }
    if (req.method === 'POST' && path === '/read-handwritten') {
      const { image } = await body(req);
      if (typeof image !== 'string' || image.length < 100) return send(res, 400, { error: 'image (base64 JPEG) required' });
      const t0 = Date.now();
      const lines = await readHandwritten(image);
      console.log(`[handwritten] ${lines.length} lines in ${Date.now() - t0} ms`);
      return send(res, 200, { lines, model: 'gemini' });
    }
    if (req.method === 'POST' && path === '/read-gemini') {
      const { image } = await body(req);
      if (typeof image !== 'string' || image.length < 100) return send(res, 400, { error: 'image (base64 JPEG) required' });
      const t0 = Date.now();
      const lines = await readStripWithGemini(image);
      console.log(`[gemini fallback] ${lines.length} lines in ${Date.now() - t0} ms: ${lines.slice(0, 3).join(' | ')}`);
      return send(res, 200, { lines, model: 'gemini' });
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
  server.listen(PORT, () => {
    console.log(`Gemma bridge on http://localhost:${PORT} → ${OLLAMA} (${MODEL})`);
    if (!GEMINI_KEY) return console.log('Gemini (fallback + handwriting): off (set GEMINI_API_KEY to enable)');
    console.log('Gemini (fallback + handwriting): on, checking which models this key can use…');
    probeGeminiModels();
  });
}
