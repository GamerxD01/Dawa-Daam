import { describe, expect, it } from 'vitest';
import raw from '../generated/drugs.json';
import { buildIndex, search } from './search';
import { compositionKey, equivalentGroup, groupGenerics, saving } from './equivalence';
import { nameSimilarity, normalise, parseQuery, phonetic } from './text';
import type { DrugData, Hit, SearchResult } from './types';

const data = raw as unknown as DrugData;
const index = buildIndex(data);

const label = (h: Hit) => (h.type === 'brand' ? h.brand.name : `JA ${h.group.items[0].code}`);
const matched = (r: SearchResult) => (r.kind === 'match' ? label(r.hit) : `<${r.kind}>`);
const listed = (r: SearchResult) =>
  r.kind === 'didyoumean' || r.kind === 'strength' ? r.hits.map(label) : r.kind === 'none' ? r.near.map(label) : [];

describe('text helpers', () => {
  it('splits letters from digits and drops units', () => {
    expect(normalise('DOLO-650 TAB')).toBe('dolo 650 tab');
    expect(parseQuery('Pan40mg').numbers).toEqual([40]);
    expect(parseQuery('galvusmet 50/500')).toEqual({ name: 'galvusmet', numbers: [50, 500] });
  });
  it('reads Devanagari digits', () => {
    expect(parseQuery('डोलो ६५०').numbers).toEqual([650]);
  });
  it('gives the same phonetic key to common Indian spellings', () => {
    expect(phonetic('lirika')).toBe(phonetic('lyrica'));
    expect(phonetic('rozuvas')).toBe(phonetic('rosuvas'));
    expect(phonetic('alegra')).toBe(phonetic('allegra'));
  });
  it('never treats a letter suffix as the same product', () => {
    expect(nameSimilarity('montair', 'montair lc')).toBeLessThan(0.85);
    expect(nameSimilarity('pan', 'pan d')).toBeLessThan(0.85);
  });
});

describe('data integrity', () => {
  const groups = groupGenerics(data.generics);
  it.each(data.brands.map((b) => [b.name, b] as const))('%s maps to its expected Jan Aushadhi code', (_n, b) => {
    const g = equivalentGroup(b, groups);
    expect(g, `${b.name} has no equivalent group (${compositionKey(b.comp, b.form)})`).not.toBeNull();
    expect(g!.items.map((i) => i.code)).toContain(b.expectedJa);
  });
  it('picks the cheapest of duplicate Jan Aushadhi listings', () => {
    const thyronorm = data.brands.find((b) => b.name === 'Thyronorm 50')!;
    expect(saving(thyronorm, equivalentGroup(thyronorm, groups)!).generic.code).toBe(506);
  });
  it('shows the saving at the brand pack size', () => {
    const lyrica = data.brands.find((b) => b.name === 'Lyrica 75')!;
    const s = saving(lyrica, equivalentGroup(lyrica, groups)!);
    expect(s.brandPrice).toBe(841.87);
    expect(s.genericPrice).toBe(30.8); // 14 capsules × ₹2.20
    expect(s.pct).toBe(96);
  });
});

// The bad-input suite: what real people type at a chemist counter.
describe('search: exact answers', () => {
  it.each([
    ['dolo', 'Dolo 650'],
    ['dolo650', 'Dolo 650'],
    ['DOLO-650 TAB', 'Dolo 650'],
    ['dollo 650', 'Dolo 650'],
    ['crocin advanc', 'Crocin Advance 650'],
    ['pan 40', 'Pan 40'],
    ['pan40', 'Pan 40'],
    ['pan d', 'Pan D'],
    ['pand', 'Pan D'],
    ['razo', 'Razo 20'],
    ['omez', 'Omez 20'],
    ['telma', 'Telma 40'],
    ['telma h', 'Telma H'],
    ['telmaH', 'Telma H'],
    ['telma am', 'Telma AM'],
    ['amlong', 'Amlong 5'],
    ['atorva', 'Atorva 10'],
    ['rosuvas 10', 'Rosuvas 10'],
    ['rozuvas', 'Rosuvas 10'],
    ['ecosprin', 'Ecosprin 75'],
    ['clopitab', 'Clopitab 75'],
    ['glycomet sr', 'Glycomet 500 SR'],
    ['glycomet gp1', 'Glycomet GP 1'],
    ['amaryl 1', 'Amaryl 1'],
    ['galvus', 'Galvus 50'],
    ['galvus met', 'Galvus Met 50/500'],
    ['galvusmet 50/500', 'Galvus Met 50/500'],
    ['thyronorm 50', 'Thyronorm 50'],
    ['montair lc', 'Montair LC'],
    ['azithral', 'Azithral 500'],
    ['augmentin 625', 'Augmentin Duo 625'],
    ['augmentin', 'Augmentin Duo 625'],
    ['taxim o', 'Taxim-O 200'],
    ['allegra 120', 'Allegra 120'],
    ['alegra', 'Allegra 120'],
    ['ciplox 500', 'Ciplox 500'],
    ['zerodol p', 'Zerodol P'],
    ['shelcal', 'Shelcal 500'],
    ['nexito', 'Nexito 10'],
    ['lyrica', 'Lyrica 75'],
    ['lirika', 'Lyrica 75'],
    ['met xl 50', 'Met XL 50'],
    ['ondem', 'Ondem 4'],
    ['levocet', 'Levocet 5'],
    ['brufen', 'Brufen 400'],
    ['zyloric', 'Zyloric 100'],
    ['flagyl 400', 'Flagyl 400'],
    ['asthalin', 'Asthalin Inhaler'],
    ['paracetamol 650', 'JA 511'],
    ['acetaminophen 650', 'JA 511'],
    ['pantoprazol 40', 'JA 212'],
    ['rabeprazol 20', 'JA 215'],
    ['telmisartan 40', 'JA 300'],
    ['amlodipin 5', 'JA 264'],
    ['thyroxin 50', 'JA 506'],
    ['azithromycine 500', 'JA 72'],
    ['levocetrizine', 'JA 248'],
    ['amoxyclav 625', 'JA 39'],
    ['metoprolol 25', 'JA 290'],
    ['डोलो ६५०'.replace('डोलो', 'dolo'), 'Dolo 650'],
  ])('%s → %s', (q, want) => {
    expect(matched(search(index, q))).toBe(want);
  });
});

describe('search: real strips photographed for this project', () => {
  it('Garyfex-180 (MRP read off the strip) → Jan Aushadhi fexofenadine 180', () => {
    const r = search(index, 'Garyfex-180');
    expect(matched(r)).toBe('Garyfex 180');
    if (r.kind === 'match' && r.hit.type === 'brand') expect(saving(r.hit.brand, r.hit.group!).genericPrice).toBe(37.4);
  });
  it('Panced-DSR composition line → pantoprazole GR + domperidone PR capsule', () => {
    const r = search(index, 'Pantoprazole Sodium Gastro-Resistant and Domperidone Prolonged-Release Capsules IP');
    expect(r.kind === 'match' || r.kind === 'didyoumean').toBe(true);
    const hits = r.kind === 'match' ? [label(r.hit)] : listed(r);
    expect(hits).toContain('JA 465');
  });
  it('hydroxyzine 25 (Giorax-25): we only have 10 mg, so we say so', () => {
    const r = search(index, 'hydroxyzine hydrochloride 25');
    expect(r.kind).toBe('none');
    if (r.kind === 'none') expect(r.reason).toBe('strength-unavailable');
  });
  it('Lactopen (lactic acid bacillus) → Jan Aushadhi 196', () => {
    expect(matched(search(index, 'lactic acid bacillus tablets'))).toBe('JA 196');
  });
  it('Nutricion-5G (a nutraceutical, not a medicine) → not found', () => {
    expect(search(index, 'Nutricion-5G').kind).toBe('none');
  });
});

describe('search: asks instead of guessing', () => {
  it('half-read word → did you mean', () => {
    const r = search(index, 'pantop');
    expect(r.kind === 'didyoumean' || r.kind === 'strength').toBe(true);
    expect(listed(r)).toContain('JA 212');
  });
  it('montair alone is not silently Montair LC', () => {
    const r = search(index, 'montair');
    expect(r.kind).toBe('didyoumean');
    expect(listed(r)).toContain('Montair LC');
  });
  it('zerodol alone is not silently Zerodol P', () => {
    expect(search(index, 'zerodol').kind).not.toBe('match');
  });
  it('taxim alone is not silently Taxim-O', () => {
    expect(search(index, 'taxim').kind).toBe('didyoumean');
  });
  it('molecule without strength → strength chooser', () => {
    const r = search(index, 'paracitamol');
    expect(r.kind).toBe('strength');
    expect(listed(r)).toEqual(expect.arrayContaining(['JA 23', 'JA 511']));
  });
  it('same molecule in two forms (capsule and tablet) → user chooses', () => {
    const r = search(index, 'pregablin 75');
    expect(r.kind).toBe('didyoumean');
    expect(listed(r)).toEqual(expect.arrayContaining(['JA 3', 'JA 599']));
  });
  it('glycomet alone does not pick SR or GP silently', () => {
    expect(search(index, 'glycomet').kind).not.toBe('match');
  });
});

describe('search: safety — never the wrong medicine', () => {
  it('Met XL (ER) is never linked to immediate-release metoprolol', () => {
    const r = search(index, 'met xl 50');
    expect(r.kind === 'match' && r.hit.type === 'brand' && r.hit.group!.items[0].code).toBe(291);
  });
  it('Glycomet SR maps to prolonged-release metformin, not plain', () => {
    const r = search(index, 'glycomet sr');
    expect(r.kind === 'match' && r.hit.type === 'brand' && r.hit.group!.items.map((i) => i.code)).toEqual([372]);
  });
  it('a strength we do not have is reported, not swapped', () => {
    const r = search(index, 'amaryl 2');
    expect(r.kind).toBe('none');
    if (r.kind === 'none') {
      expect(r.reason).toBe('strength-unavailable');
      expect(r.name).toBe('Amaryl 1');
      expect(listed(r)).toContain('JA 138'); // glimepiride 2 mg generic, offered as info only
    }
  });
  it('glycomet gp 2 does not return GP 1', () => {
    expect(matched(search(index, 'glycomet gp 2'))).not.toBe('Glycomet GP 1');
  });
  it('unknown → none', () => {
    expect(search(index, 'xyzabc').kind).toBe('none');
  });
  it('empty → empty', () => {
    expect(search(index, '   ').kind).toBe('empty');
    expect(search(index, 'tab').kind).toBe('empty');
  });
});
