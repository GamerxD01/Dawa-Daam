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

export async function gemmaAvailable(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(`${url}/health`, { signal: ctl.signal });
    clearTimeout(timer);
    return r.ok;
  } catch {
    return false;
  }
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
export async function readLines(file: File, maxSide = 1024): Promise<string[]> {
  const url = gemmaUrl();
  if (!url) throw new Error('no gemma server');
  const image = await toJpegBase64(file, maxSide);
  const read = await fetch(`${url}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  if (!read.ok) throw new Error(`read failed ${read.status}`);
  const { lines } = (await read.json()) as { lines: string[] };
  return lines ?? [];
}

export async function readStrip(file: File, index: Index): Promise<{ lines: string[]; hit: Hit | null }> {
  const url = gemmaUrl();
  if (!url) throw new Error('no gemma server');
  const lines = await readLines(file);
  const candidates = candidatesFromLines(lines ?? [], index);
  if (!candidates.length) return { lines, hit: null };

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
  return { lines, hit: chosen };
}
