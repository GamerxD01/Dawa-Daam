import type { Brand, Component, Form, Generic, GenericGroup } from './types';

/**
 * The safety core. Two products are "the same medicine" for price comparison only if every
 * component matches on molecule, strength, unit and release family, and the dosage form is the same.
 * SR never matches IR, a combination never matches a single molecule, 25 mg never matches 50 mg.
 */
export function compositionKey(comp: Component[], form: Form): string {
  const parts = [...comp]
    .sort((a, b) => a.m.localeCompare(b.m))
    .map((c) => `${c.m}:${c.v}${c.u}${c.per ? '/' + c.per + 'ml' : ''}:${c.r}`);
  return `${parts.join('+')}#${form}`;
}

export const moleculeSetKey = (comp: Component[]) => [...new Set(comp.map((c) => c.m))].sort().join('+');

export const perUnit = (p: { mrp: number; pack: number }) => p.mrp / p.pack;

export function groupGenerics(generics: Generic[]): Map<string, GenericGroup> {
  const groups = new Map<string, GenericGroup>();
  for (const g of generics) {
    const key = compositionKey(g.comp, g.form);
    const grp = groups.get(key) ?? { key, comp: g.comp, form: g.form, items: [] };
    grp.items.push(g);
    groups.set(key, grp);
  }
  for (const grp of groups.values()) grp.items.sort((a, b) => perUnit(a) - perUnit(b));
  return groups;
}

export function equivalentGroup(brand: Brand, groups: Map<string, GenericGroup>): GenericGroup | null {
  return groups.get(compositionKey(brand.comp, brand.form)) ?? null;
}

const ORAL_SOLID = new Set<Form>(['tablet', 'capsule']);

/**
 * Not an exact match, but worth telling the patient: same molecules, strengths and release, sold by
 * Jan Aushadhi as the other oral solid form (a capsule instead of a tablet). Shown as information only.
 */
export function sameSaltOtherForm(brand: Brand, groups: Map<string, GenericGroup>): GenericGroup | null {
  if (!ORAL_SOLID.has(brand.form)) return null;
  for (const other of ORAL_SOLID) {
    if (other === brand.form) continue;
    const g = groups.get(compositionKey(brand.comp, other));
    if (g) return g;
  }
  return null;
}

export interface Saving {
  /** brand price for the brand's own pack */
  brandPrice: number;
  /** cheapest Jan Aushadhi equivalent, scaled to the brand's pack size */
  genericPrice: number;
  saving: number;
  pct: number;
  brandPerUnit: number;
  genericPerUnit: number;
  generic: Generic;
}

export function saving(brand: Brand, group: GenericGroup): Saving {
  const generic = group.items[0];
  const brandPerUnit = perUnit(brand);
  const genericPerUnit = perUnit(generic);
  const genericPrice = round2(genericPerUnit * brand.pack);
  const s = round2(brand.mrp - genericPrice);
  return {
    brandPrice: brand.mrp,
    genericPrice,
    saving: s,
    pct: Math.round((s / brand.mrp) * 100),
    brandPerUnit,
    genericPerUnit,
    generic,
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
