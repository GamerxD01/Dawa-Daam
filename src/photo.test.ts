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
});
