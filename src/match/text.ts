// Text helpers: normalisation, query parsing, phonetic keys and similarity.

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** Words that carry no identity on a prescription or strip. */
const NOISE = new Set([
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules', 'strip', 'of',
  'mg', 'mcg', 'ml', 'ip', 'bp', 'usp', 'film', 'coated', 'syp', 'syrup', 'inj', 'oral',
  'the', 'and', 'x', 'pcs',
  // words printed on strips that describe the release form or salt, not which medicine it is
  'gastro', 'resistant', 'prolonged', 'release', 'released', 'sustained', 'extended', 'enteric',
  'modified', 'controlled', 'delayed', 'hydrochloride', 'hcl', 'sodium', 'each', 'contains', 'eq',
  // prescription table headers
  'medicine', 'medicines', 'dose', 'dosage', 'duration', 'qty', 'quantity',
]);

/** Lower-case, unify digits and separators, split letter↔digit runs ("dolo650" → "dolo 650"). */
export function normalise(input: string): string {
  let s = input.normalize('NFKC').toLowerCase();
  s = s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  s = s.replace(/(\d)\s*(mg|mcg|ml|gm|g|iu)\b/g, '$1 '); // "40mg" → "40 "
  s = s.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');
  s = s.replace(/[^a-z0-9.ऀ-ॿ/ ]+/g, ' '); // keep Devanagari letters, '/' and '.'
  s = s.replace(/\//g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export interface ParsedQuery {
  /** name words only, noise removed, e.g. "telma h" */
  name: string;
  /** numbers found, e.g. [50, 500] for "galvus met 50/500" */
  numbers: number[];
}

export function parseQuery(input: string): ParsedQuery {
  const words = normalise(input).split(' ').filter(Boolean);
  const numbers: number[] = [];
  const name: string[] = [];
  for (const raw of words) {
    const w = raw.replace(/^\.+|\.+$/g, ''); // "Tab." → "tab"
    if (!w) continue;
    if (/^\d+(\.\d+)?$/.test(w)) numbers.push(Number(w));
    else if (/^\d+k$/.test(w)) numbers.push(Number(w.slice(0, -1)) * 1000);
    else if (w === '.' ) continue;
    else if (!NOISE.has(w)) name.push(w.replace(/\./g, ''));
  }
  return { name: name.filter(Boolean).join(' '), numbers };
}

/**
 * Phonetic key tuned for how Indian English spells drug names:
 * ph/f, z/s, c/k/s, v/w, y/i, ee/ea/i, oo/u, th/t, doubled letters, dropped vowels.
 * "lirika" and "lyrica" → "lrk"; "rozuvas" and "rosuvas" → "rsvs".
 */
export function phonetic(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/x/g, 'ks').replace(/q/g, 'k')
    .replace(/th/g, 't').replace(/gh/g, 'g').replace(/kh/g, 'k')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
    .replace(/z/g, 's').replace(/v/g, 'w').replace(/y/g, 'i')
    .replace(/ee|ea/g, 'i').replace(/oo/g, 'u');
  s = s.replace(/(.)\1+/g, '$1');
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiou]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

/** Optimal-string-alignment Damerau–Levenshtein distance (handles swapped letters). */
export function damerau(a: string, b: string): number {
  const n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

export function trigrams(s: string): Set<string> {
  const t = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/**
 * How well a typed name matches a key name, 0..1.
 * Takes the best of: edit distance, phonetic equality, prefix (half-read word) and trigram overlap.
 * A prefix that stops before a letter suffix ("montair" vs "montair lc", "pan" vs "pan d") is capped,
 * because those suffix letters usually mean a different combination of molecules.
 */
export function nameSimilarity(query: string, key: string): number {
  if (!query || !key) return 0;
  if (query === key) return 1;
  const q = query.replace(/ /g, ''), k = key.replace(/ /g, '');
  if (q === k) return 0.99;
  const edit = 1 - damerau(q, k) / Math.max(q.length, k.length);
  const pq = phonetic(q), pk = phonetic(k);
  // phonetic keys only make sense for Latin-script names
  const phon = /^[a-z ]+$/.test(key) && pq.length >= 2 && pq === pk ? 0.9 : 0;
  let prefix = 0;
  if (q.length >= 3 && k.startsWith(q)) {
    prefix = 0.7 + 0.3 * (q.length / k.length);
    // the key goes on to further words ("pantoprazol" → "pantoprazole dsr"): a different product
    const consumed = key.length - (k.length - q.length);
    if (key.slice(Math.max(0, consumed - 1)).includes(' ')) prefix = Math.min(prefix, 0.8);
  }
  const tri = jaccard(trigrams(q), trigrams(k)) * 0.9;
  let best = Math.max(edit, phon, prefix, tri);
  // An exact word-boundary prefix with a different letter suffix must never look like an exact hit.
  if (key.startsWith(query + ' ') && /^[a-z]/.test(key.slice(query.length + 1))) best = Math.min(best, 0.8);
  return best;
}
