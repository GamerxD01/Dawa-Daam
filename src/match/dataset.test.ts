import { describe, expect, it } from 'vitest';
import raw from '../generated/drugs.json';
import file from '../../public/data/brands.json';
import { compositionKey } from './equivalence';
import { hydrateDataset, type DatasetFile } from './dataset';
import { buildIndex, search } from './search';
import type { DrugData, Hit, SearchResult } from './types';

const core = raw as unknown as DrugData;
const extra = hydrateDataset(core, file as unknown as DatasetFile);
const index = buildIndex({ ...core, brands: [...core.brands, ...extra] });
const label = (h: Hit) => (h.type === 'brand' ? h.brand.name : `JA ${h.group.items[0].code}`);
const matched = (r: SearchResult) => (r.kind === 'match' ? label(r.hit) : `<${r.kind}>`);

describe('full index with the public-dataset brands', () => {
  it('loads tens of thousands of brands, every one an exact Jan Aushadhi equivalent', () => {
    expect(extra.length).toBeGreaterThan(50000);
    const groups = new Set(core.generics.map((g) => compositionKey(g.comp, g.form)));
    expect(extra.every((b) => groups.has(compositionKey(b.comp, b.form)))).toBe(true);
    expect(extra.every((b) => !b.verified)).toBe(true);
  });
  it.each([
    ['pan 40', 'Pan 40'], ['dolo 650', 'Dolo 650'], ['telma h', 'Telma H'], ['azee 500', 'Azee 500'],
    ['Rozanex CV', 'Rozanex CV 10 mg/75 mg'], ['paracetamol 650', 'JA 511'],
  ])('%s → %s (an exactly typed name wins over look-alikes)', (q, want) => expect(matched(search(index, q))).toBe(want));
  it('checked brands stay first among near-equal spellings', () => {
    const r = search(index, 'lirika');
    expect(r.kind === 'didyoumean' && label(r.hits[0])).toBe('Lyrica 75');
  });
  it('still says "not that strength" instead of offering a look-alike', () => {
    const r = search(index, 'hydroxyzine 50');
    expect(r.kind === 'none' && r.reason).toBe('strength-unavailable');
  });
  it('a 3-ingredient cold tablet is never matched to a 2-ingredient generic', () => {
    expect(search(index, 'cheston cold').kind).not.toBe('match');
  });
  it('searches stay fast (< 100 ms on a laptop)', () => {
    const t = performance.now();
    for (const q of ['pan 40', 'lirika', 'rozuvas 10', 'metformin 500', 'xyzzy']) search(index, q);
    expect((performance.now() - t) / 5).toBeLessThan(100);
  });
});
