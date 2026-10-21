import { describe, expect, it } from 'vitest';
import raw from './generated/drugs.json';
import { buildIndex } from './match/search';
import type { DrugData } from './match/types';
import { candidatesFromLines } from './photo';
import { hitId } from './store';

const index = buildIndex(raw as unknown as DrugData);

describe('candidates from text Gemma read off a strip', () => {
  it('finds the brand from typical strip lines', () => {
    const c = candidatesFromLines(['PAN 40', 'Pantoprazole Gastro-resistant Tablets IP 40 mg', '15 Tablets'], index);
    expect(c.map(hitId)).toContain('b:pan-40');
  });
  it('combines a brand line with the strength on the next line', () => {
    const c = candidatesFromLines(['Telma', '40'], index);
    expect(c.map(hitId)[0]).toBe('b:telma-40');
  });
  it('returns nothing for unreadable text', () => {
    expect(candidatesFromLines(['', 'Batch No. XK2231', 'Mfd. 05/2026'], index)).toEqual([]);
  });

  // Exact text Gemma 4 E2B returned for our own strip photos (see docs/GEMMA.md)
  it('recovers a brand Gemma misread ("Ganytex-180" for Garyfex-180)', () => {
    const c = candidatesFromLines(['B.N.TG629 M. Rs.175.00', 'MFG. 03/2026 EXP. 02/2028', 'INCL ALL TAXES', 'Ganytex-180'], index);
    expect(c.map(hitId)).toContain('b:garyfex-180');
  });
  it('finds Lactopen from its composition lines', () => {
    const c = candidatesFromLines(['Each uncoated tablet contains:', 'Lactopen', 'Lactic Acid', 'Bacillus Tablets'], index);
    expect(c.map((h) => (h.type === 'generic' ? h.group.items[0].code : null))).toContain(196);
  });
  it('offers nothing for an unreadable strip or a nutraceutical', () => {
    expect(candidatesFromLines(['EXP. 07/2027', 'Mfg. 08/2025', 'No. G750088C', 'DPRET-8 DP'], index)).toEqual([]);
    expect(candidatesFromLines(['out of the reach of', 'Other Ingredients: Soy Lecithin (INS 479), Soya Bean Oil (INS 320)', 'Store in a cool, dry & dark place'], index)).toEqual([]);
  });
});
