import { compositionKey, equivalentGroup, groupGenerics, moleculeSetKey, sameSaltOtherForm } from './equivalence';
import { nameSimilarity, parseQuery } from './text';
import type { Brand, DrugData, GenericGroup, Hit, SearchResult } from './types';

/** A searchable thing: a curated brand, or a group of equivalent Jan Aushadhi generics. */
type Unscored<T> = T extends unknown ? Omit<T, 'score'> : never;

interface Entry {
  hit: Unscored<Hit>;
  /** normalised name keys (no numbers), e.g. ["telma h", "telmah"] */
  keys: string[];
  /** numbers a user might type for this product: strengths, sums ("625"), numbers in the brand name */
  numbers: Set<number>;
  /** stable label for tie-breaking */
  label: string;
}

export const THRESHOLD_MATCH = 0.85;
export const THRESHOLD_SUGGEST = 0.55;
const GAP = 0.08;

export interface Index {
  entries: Entry[];
  groups: Map<string, GenericGroup>;
  data: DrugData;
}

export function buildIndex(data: DrugData): Index {
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

  for (const b of data.brands) {
    const names = [b.name, ...b.aliases].map(parseQuery);
    entries.push({
      hit: { type: 'brand', brand: b, group: equivalentGroup(b, groups), otherForm: equivalentGroup(b, groups) ? null : sameSaltOtherForm(b, groups) },
      keys: uniq(names.map((n) => n.name)),
      numbers: new Set([...names.flatMap((n) => n.numbers), ...compNumbers(b.comp)]),
      label: b.name,
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
    const brands = data.brands.filter((b) => compositionKey(b.comp, b.form) === g.key);
    entries.push({
      hit: { type: 'generic', group: g, brands },
      keys: uniq(keys.filter(Boolean)),
      numbers: new Set(compNumbers(g.comp)),
      label: g.items[0].name,
    });
  }
  return { entries, groups, data };
}

interface Scored {
  entry: Entry;
  name: number;
  score: number;
  conflict: boolean;
}

export function search(index: Index, input: string): SearchResult {
  const q = parseQuery(input);
  if (!q.name && !q.numbers.length) return { kind: 'empty' };
  if (!q.name) return { kind: 'none', reason: 'unknown', near: [] };

  const scored: Scored[] = index.entries.map((entry) => {
    const name = Math.max(...entry.keys.map((k) => nameSimilarity(q.name, k)));
    let score = name;
    let conflict = false;
    if (q.numbers.length) {
      const allKnown = q.numbers.every((n) => entry.numbers.has(n));
      if (allKnown) score = Math.min(1, score + 0.05);
      else conflict = true; // typed a strength this product does not have
    }
    // a brand typed by name should beat the generic group for the same name
    if (entry.hit.type === 'generic') score -= 0.01;
    return { entry, name, score, conflict };
  });

  const ok = scored.filter((s) => !s.conflict).sort(byScore);
  const top = ok[0];

  // Nothing good without a strength conflict, but the name clearly matched: say exactly that.
  if (!top || top.score < THRESHOLD_SUGGEST) {
    const conflicted = scored.filter((s) => s.conflict && s.name >= THRESHOLD_MATCH).sort(byScore);
    if (conflicted.length) {
      const named = conflicted[0].entry;
      const molecules = moleculeSetKey(entryComp(named));
      // Jan Aushadhi products with the same molecule(s) that DO have the typed strength
      const near = index.entries
        .filter((e) => e.hit.type === 'generic' && moleculeSetKey(entryComp(e)) === molecules &&
          q.numbers.every((n) => e.numbers.has(n)))
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

  return { kind: 'didyoumean', hits: ok.filter((s) => s.score >= THRESHOLD_SUGGEST).slice(0, 4).map((s) => toHit(s.entry, s.score)) };
}

function entryComp(e: Entry) {
  return e.hit.type === 'brand' ? e.hit.brand.comp : e.hit.group.comp;
}

function toHit(e: Entry, score: number): Hit {
  return { ...e.hit, score } as Hit;
}

function byScore(a: Scored, b: Scored) {
  return b.score - a.score || a.entry.label.localeCompare(b.entry.label);
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
  return index.entries
    .filter((e) => e.keys.some((k) => k === q || k.startsWith(q + ' ')))
    .map((e) => toHit(e, 0.6));
}
