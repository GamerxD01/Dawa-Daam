// The official Jan Aushadhi Kendra list (janaushadhi.gov.in), searchable offline by PIN code, district or place.
// Loaded from public/data/kendras.json the first time it is needed and then cached by the service worker.

export interface KendraFile {
  version: string;
  source: string;
  states: string[];
  districts: string[];
  /** [code, state index, district index, PIN, address] */
  rows: [string, number, number, string, string][];
}

export interface OfficialKendra {
  code: string;
  state: string;
  district: string;
  pin: string;
  address: string;
}

export function expand(file: KendraFile): OfficialKendra[] {
  return file.rows.map(([code, s, d, pin, address]) => ({ code, state: file.states[s], district: file.districts[d], pin, address }));
}

let cached: Promise<{ list: OfficialKendra[]; file: KendraFile }> | null = null;
export function loadKendras(base: string, version: string) {
  cached ??= fetch(`${base}data/kendras.json?v=${version}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((file: KendraFile) => ({ list: expand(file), file }))
    .catch((e) => {
      cached = null; // allow a retry
      throw e;
    });
  return cached;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();

/**
 * "226024" → Kendras with that PIN first, then the nearest PIN codes in the same area (same first 3 digits).
 * "lucknow", "aliganj", "kanpur nagar" → district matches first, then addresses containing every word.
 */
export function searchKendras(list: OfficialKendra[], query: string, limit = 30): OfficialKendra[] {
  const q = norm(query);
  if (!q) return [];
  const pin = /^\d{6}$/.exec(q.replace(/\s/g, ''))?.[0];
  if (pin) {
    const area = pin.slice(0, 3), n = Number(pin);
    return list
      .filter((k) => k.pin.startsWith(area))
      .sort((a, b) => Math.abs(Number(a.pin) - n) - Math.abs(Number(b.pin) - n) || a.code.localeCompare(b.code))
      .slice(0, limit);
  }
  if (/^\d+$/.test(q)) return q.length >= 3 ? list.filter((k) => k.pin.startsWith(q)).slice(0, limit) : [];
  const words = q.split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [];
  // district named ("lucknow", "kanpur nagar") scores 2; every word found in the address scores 1; both: 3
  const scored = list.map((k) => {
    const d = norm(k.district), where = norm(`${k.address} ${k.district}`);
    const inDistrict = d === q || d.startsWith(q) || words.some((w) => d === w || (w.length >= 4 && d.startsWith(w)));
    const inAddress = words.every((w) => where.includes(w));
    return { k, score: (inDistrict ? 2 : 0) + (inAddress ? 1 : 0) };
  }).filter((x) => x.score > 0);
  // "lucknow aliganj": both words must count, so a district-only hit for one word is weaker than both words found
  return scored.sort((a, b) => b.score - a.score || a.k.pin.localeCompare(b.k.pin)).slice(0, limit).map((x) => x.k);
}

export const mapsSearchUrl = (k: OfficialKendra) =>
  `https://www.google.com/maps/search/${encodeURIComponent(`Jan Aushadhi Kendra ${k.address} ${k.district} ${k.pin}`)}`;
