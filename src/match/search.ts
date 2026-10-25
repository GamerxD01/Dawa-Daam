import { compositionKey, equivalentGroup, groupGenerics, moleculeSetKey, sameSaltOtherForm } from './equivalence';
import { damerau, nameSimilarity, parseQuery, phonetic, trigrams } from './text';
import type { Brand, DrugData, GenericGroup, Hit, SearchResult } from './types';

/** A searchable thing: a curated brand, or a group of equivalent Jan Aushadhi generics. */
type Unscored<T> = T extends unknown ? Omit<T, 'score'> : never;

interface Entry {
  hit: Unscored<Hit>;
  /** normalised name keys (no numbers), e.g. ["telma h", "telmah"] */
  keys: string[];
  /** numbers a user might type for this product: strengths, sums ("625"), numbers in the brand name */
  numbers: number[];
  /** stable label for tie-breaking */
  label: string;
  /** a brand from our own checked list (ranked first among near-equal answers) */
  curated: boolean;
}

export const THRESHOLD_MATCH = 0.85;
export const THRESHOLD_SUGGEST = 0.55;
const GAP = 0.08;

export interface Index {
  entries: Entry[];
  groups: Map<string, GenericGroup>;
  data: DrugData;
  /** trigram of a key (spaces removed) → entry numbers; lets a search score a few hundred entries, not all of them */
  tri: Map<string, Iterable<number>>;
  /** phonetic key → entry numbers, so "lirika" always reaches "lyrica" */
  phon: Map<string, Iterable<number>>;
  /** Jan Aushadhi group entries (small), for the "we have this strength instead" list */
  genericEntries: Entry[];
}

/** Build the search index in one go (small data, tests). */
export function buildIndex(data: DrugData): Index {
  const steps = indexSteps(data);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** Build it in small slices, giving the browser a chance to paint between them (large data on a slow phone). */
export async function buildIndexAsync(data: DrugData, sliceMs = 12): Promise<Index> {
  const steps = indexSteps(data);
  let t = performance.now();
  for (let r = steps.next(); ; r = steps.next()) {
    if (r.done) return r.value;
    if (performance.now() - t > sliceMs) {
      await new Promise((ok) => setTimeout(ok, 0));
      t = performance.now();
    }
  }
}

function* indexSteps(data: DrugData): Generator<void, Index> {
  const groups = groupGenerics(data.generics);
  const entries: Entry[] = [];
  const synonyms = new Map(data.molecules.map((m) => [m.name, [m.name, ...m.synonyms]]));
  const hindi = new Map(data.molecules.map((m) => [m.name, m.hi]));
  const combo = new Map(data.comboAliases.map((c) => [c.molecules.join('+'), c.aliases]));

  const compNumbers = (comp: Brand['comp']) => {
    const ns = comp.map((c) => c.v);
    if (comp.length === 2) ns.push(comp[0].v + comp[1].v); // "625" = 500 + 125
    return ns;
  };

  const brandsByKey = new Map<string, Brand[]>();
  for (const b of data.brands) {
    const k = compositionKey(b.comp, b.form);
    (brandsByKey.get(k) ?? brandsByKey.set(k, []).get(k)!).push(b);
  }

  let n = 0;
  for (const b of data.brands) {
    if (++n % 200 === 0) yield;
    const names = [b.name, ...b.aliases].map(parseQuery);
    entries.push({
      hit: (() => {
        const group = equivalentGroup(b, groups);
        return { type: 'brand' as const, brand: b, group, otherForm: group ? null : sameSaltOtherForm(b, groups) };
      })(),
      keys: uniq(names.map((n) => n.name)),
      numbers: uniq([...names.flatMap((n) => n.numbers), ...compNumbers(b.comp)]),
      label: b.name,
      curated: !b.source.startsWith('dataset:'),
    });
  }

  for (const g of groups.values()) {
    const ms = [...new Set(g.comp.map((c) => c.m))].sort();
    // every way of naming the molecules: canonical, synonyms, Hindi; plus combo nicknames
    let variants: string[][] = [[]];
    for (const m of ms) variants = variants.flatMap((v) => (synonyms.get(m) ?? [m]).map((s) => [...v, s]));
    const keys = variants.slice(0, 24).map((v) => parseQuery(v.join(' ')).name);
    if (ms.every((m) => hindi.get(m))) keys.push(ms.map((m) => hindi.get(m)).join(' '));
    keys.push(...(combo.get(ms.join('+')) ?? []).map((a) => parseQuery(a).name));
    const brands = brandsByKey.get(g.key) ?? [];
    entries.push({
      hit: { type: 'generic', group: g, brands },
      keys: uniq(keys.filter(Boolean)),
      numbers: uniq(compNumbers(g.comp)),
      label: g.items[0].name,
      curated: true,
    });
  }

  const tri = new Map<string, number[]>(), phon = new Map<string, number[]>();
  const post = (m: Map<string, number[]>, k: string, i: number) => {
    const l = m.get(k);
    if (!l) m.set(k, [i]);
    else if (l[l.length - 1] !== i) l.push(i);
  };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (i % 500 === 0) yield;
    for (const key of e.keys) {
      const c = key.replace(/ /g, '');
      for (const g of trigrams(c)) post(tri, g, i);
      if (/^[a-z]+$/.test(c)) post(phon, phonetic(c), i);
    }
  }
  // packed arrays: a fraction of the memory of plain arrays for ~100k entries
  const pack = (m: Map<string, number[]>) => new Map([...m].map(([k, v]) => [k, Int32Array.from(v)] as const));
  return { entries, groups, data, tri: pack(tri), phon: pack(phon), genericEntries: entries.filter((e) => e.hit.type === 'generic') };
}

const MAX_CANDIDATES = 1500;

/** Entries worth scoring for this name: share enough trigrams, or the same phonetic key. */
function candidates(index: Index, name: string): Entry[] {
  const c = name.replace(/ /g, '');
  const grams = trigrams(c);
  const counts = new Uint16Array(index.entries.length);
  const touched: number[] = [];
  const bump = (i: number, by: number) => {
    if (counts[i] === 0) touched.push(i);
    counts[i] += by;
  };
  for (const g of grams) for (const i of index.tri.get(g) ?? []) bump(i, 1);
  if (/^[a-z]+$/.test(c)) for (const i of index.phon.get(phonetic(c)) ?? []) bump(i, 1000);
  const min = Math.max(1, Math.floor(grams.size * 0.25));
  let ids = touched.filter((i) => counts[i] >= min);
  if (ids.length > MAX_CANDIDATES) ids = ids.sort((a, b) => counts[b] - counts[a]).slice(0, MAX_CANDIDATES);
  return ids.map((i) => index.entries[i]);
}

interface Scored {
  entry: Entry;
  name: number;
  score: number;
  conflict: boolean;
  rank: number;
}

export function search(index: Index, input: string): SearchResult {
  const q = parseQuery(input);
  if (!q.name && !q.numbers.length) return { kind: 'empty' };
  if (!q.name) return { kind: 'none', reason: 'unknown', near: [] };

  const qc = q.name.replace(/ /g, '');
  const scored: Scored[] = candidates(index, q.name).map((entry) => {
    let name = 0, fine = 0;
    for (const k of entry.keys) {
      const n = nameSimilarity(q.name, k);
      if (n > name || (n === name && fine === 0)) {
        name = n;
        const kc = k.replace(/ /g, '');
        fine = 1 - damerau(qc, kc) / Math.max(qc.length, kc.length);
      }
    }
    let score = name;
    let conflict = false;
    if (q.numbers.length) {
      const allKnown = q.numbers.every((n) => entry.numbers.includes(n));
      if (allKnown) score = Math.min(1, score + 0.05);
      else conflict = true; // typed a strength this product does not have
    }
    // a brand typed by name should beat the generic group for the same name
    if (entry.hit.type === 'generic') score -= 0.01;
    // ranking only (not thresholds): the closer spelling first, then our own checked list
    const rank = score + 0.03 * fine + (entry.curated ? 0.01 : 0);
    return { entry, name, score, conflict, rank };
  });

  const ok = scored.filter((s) => !s.conflict).sort(byScore);
  const top = ok[0];

  // The name clearly matched but not with that strength, and nothing else is a confident match: say exactly that,
  // rather than offer a look-alike name that happens to have the strength ("hydroxyzine 50" is not levothyroxine 50).
  const conflicted = scored.filter((s) => s.conflict && s.name >= THRESHOLD_MATCH).sort(byScore);
  const nameWins = conflicted.length > 0 && (!top || (top.score < THRESHOLD_MATCH && conflicted[0].name >= top.name + GAP));
  if (!top || top.score < THRESHOLD_SUGGEST || nameWins) {
    if (conflicted.length) {
      const named = conflicted[0].entry;
      const molecules = moleculeSetKey(entryComp(named));
      // Jan Aushadhi products with the same molecule(s) that DO have the typed strength
      const near = index.genericEntries
        .filter((e) => moleculeSetKey(entryComp(e)) === molecules &&
          q.numbers.every((n) => e.numbers.includes(n)))
        .map((e) => toHit(e, 0.6));
      return { kind: 'none', reason: 'strength-unavailable', name: named.label, requested: q.numbers, near };
    }
    return { kind: 'none', reason: 'unknown', near: ok.filter((s) => s.score >= 0.45).slice(0, 3).map((s) => toHit(s.entry, s.score)) };
  }

  // A brand and the Jan Aushadhi group that is its exact equivalent are one answer, not two rivals.
  const brandGroups = new Set(ok.filter((s) => s.entry.hit.type === 'brand' && s.entry.hit.group).map((s) =>
    s.entry.hit.type === 'brand' ? s.entry.hit.group!.key : ''));
  const isShadow = (s: Scored) => s.entry.hit.type === 'generic' && brandGroups.has(s.entry.hit.group.key) && s.score < top.score;
  const close = ok.filter((s) => s.score >= Math.max(THRESHOLD_SUGGEST, top.score - GAP) && !isShadow(s));

  // Same molecule(s), only the strength differs, and the user gave no strength → ask which strength.
  if (!q.numbers.length && close.length > 1) {
    const sets = new Set(close.map((s) => moleculeSetKey(entryComp(s.entry)) + '|' + s.entry.hit.type));
    if (sets.size === 1) return { kind: 'strength', hits: close.map((s) => toHit(s.entry, s.score)).sort(byStrength) };
  }

  if (top.score >= THRESHOLD_MATCH && close.length === 1) return { kind: 'match', hit: toHit(top.entry, top.score) };

  // The name was typed exactly ("Pan 40", "Dolo 650") and no other product has that exact name: that is the answer,
  // even though similar names exist ("Pano 40", "Doel 650").
  const exact = close.filter((s) => s.name >= 0.99);
  if (exact.length === 1 && exact[0] === top) return { kind: 'match', hit: toHit(top.entry, top.score) };

  return { kind: 'didyoumean', hits: ok.filter((s) => s.score >= THRESHOLD_SUGGEST).slice(0, 4).map((s) => toHit(s.entry, s.score)) };
}

function entryComp(e: Entry) {
  return e.hit.type === 'brand' ? e.hit.brand.comp : e.hit.group.comp;
}

function toHit(e: Entry, score: number): Hit {
  return { ...e.hit, score } as Hit;
}

function byScore(a: Scored, b: Scored) {
  return b.rank - a.rank || a.entry.label.localeCompare(b.entry.label);
}

function byStrength(a: Hit, b: Hit) {
  const v = (h: Hit) => (h.type === 'brand' ? h.brand.comp : h.group.comp).reduce((s, c) => s + c.v, 0);
  return v(a) - v(b);
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Every product whose name starts with these words ("pan" → Pan 40, Pan D). Used when a word after them was unreadable. */
export function prefixHits(index: Index, prefix: string): Hit[] {
  const q = parseQuery(prefix).name;
  if (q.length < 3) return [];
  return candidates(index, q)
    .filter((e) => e.keys.some((k) => k === q || k.startsWith(q + ' ')))
    .map((e) => toHit(e, 0.6));
}
