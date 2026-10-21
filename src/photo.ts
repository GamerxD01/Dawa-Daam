// Client side of the optional photo feature.
// Gemma's two jobs (see server/): 1) transcribe printed text, 2) pick one id from OUR candidate list.
// Every fact shown afterwards comes from our bundled data, and the user must confirm.
import { search, type Index } from './match/search';
import type { Hit } from './match/types';
import { hitId, load, save } from './store';
import { compositionText } from './format';

/** Where the Gemma bridge lives: ?gemma=<url> (remembered), VITE_GEMMA_URL, or same-origin /gemma via the dev proxy. */
export function gemmaUrl(): string | null {
  try {
    const p = new URLSearchParams(location.search).get('gemma');
    if (p) save('gemma', p);
    const stored = load<string | null>('gemma', null);
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  const env = import.meta.env.VITE_GEMMA_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  return location.hostname.endsWith('github.io') ? null : './gemma';
}

export interface BridgeHealth {
  ok: boolean;
  /** handwritten prescriptions enabled on this bridge (Gemini key set by the laptop owner) */
  handwriting: boolean;
}

export async function bridgeHealth(url: string): Promise<BridgeHealth> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(`${url}/health`, { signal: ctl.signal });
    clearTimeout(timer);
    const j = r.ok ? await r.json().catch(() => ({})) : {};
    return { ok: r.ok, handwriting: Boolean(r.ok && j.handwriting) };
  } catch {
    return { ok: false, handwriting: false };
  }
}

export async function gemmaAvailable(url: string): Promise<boolean> {
  return (await bridgeHealth(url)).ok;
}

/** Downscale to ≤1024 px and JPEG-encode: smaller upload on a weak connection, faster on a small GPU. */
async function toJpegBase64(file: File, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/** Candidates from OCR lines: search each line and each pair of neighbouring lines (name + strength). */
export function candidatesFromLines(lines: string[], index: Index, limit = 5): Hit[] {
  const pool = new Map<string, Hit>();
  const add = (h: Hit) => {
    const id = hitId(h);
    const prev = pool.get(id);
    if (!prev || prev.score < h.score) pool.set(id, h);
  };
  const texts = [...lines, ...lines.slice(1).map((l, i) => `${lines[i]} ${l}`)];
  for (const text of texts) {
    const r = search(index, text);
    if (r.kind === 'match') add(r.hit);
    else if (r.kind === 'didyoumean' || r.kind === 'strength') r.hits.forEach(add);
  }
  return [...pool.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Gemma job 1 only: the printed text, line by line. */
/** printed = local Gemma · gemini = cloud fallback for strips · handwritten = cloud, handwriting prompt */
export type ReadMode = 'printed' | 'gemini' | 'handwritten';
const ENDPOINT: Record<ReadMode, string> = { printed: 'read', gemini: 'read-gemini', handwritten: 'read-handwritten' };

export async function readLines(file: File, maxSide = 1024, mode: ReadMode = 'printed'): Promise<{ lines: string[]; packaging: string }> {
  const url = gemmaUrl();
  if (!url) throw new Error('no gemma server');
  const image = await toJpegBase64(file, maxSide);
  const read = await fetch(`${url}/${ENDPOINT[mode]}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  if (!read.ok) throw new Error(`read failed ${read.status}`);
  const data = (await read.json()) as { lines: string[]; packaging?: string };
  return { lines: data.lines ?? [], packaging: data.packaging ?? 'wrapper' };
}

export async function readStrip(file: File, index: Index, mode: 'printed' | 'gemini' = 'printed'): Promise<{ lines: string[]; hit: Hit | null; packaging: string }> {
  const url = gemmaUrl();
  if (!url) throw new Error('no gemma server');
  // Whichever model read the text, the local Gemma still makes the pick from OUR candidates.
  const { lines, packaging } = await readLines(file, 1024, mode);
  const candidates = candidatesFromLines(lines ?? [], index);
  if (!candidates.length) return { lines, hit: null, packaging };

  const pick = await fetch(`${url}/pick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lines,
      candidates: candidates.map((h) => ({
        id: hitId(h),
        name: h.type === 'brand' ? h.brand.name : h.group.items[0].name,
        composition: compositionText(h.type === 'brand' ? h.brand.comp : h.group.comp),
      })),
    }),
  });
  const { id } = pick.ok ? ((await pick.json()) as { id: string | null }) : { id: null };
  // Gemma may only choose from our list; anything else is ignored.
  const chosen = candidates.find((h) => hitId(h) === id) ?? null;
  return { lines, hit: chosen, packaging };
}
