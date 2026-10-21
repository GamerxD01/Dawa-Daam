import type { Component, Molecule } from './match/types';

export const rupees = (n: number) =>
  '₹' + (Number.isInteger(n) ? n.toString() : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const RELEASE: Record<Component['r'], string> = { IR: '', MR: ' (SR/ER)', GR: ' (gastro-resistant)' };

export function compositionText(comp: Component[], molecules?: Map<string, Molecule>, lang: 'hi' | 'en' = 'en') {
  return comp
    .map((c) => {
      const hi = lang === 'hi' ? molecules?.get(c.m)?.hi : '';
      const name = hi ? `${title(c.m)} (${hi})` : title(c.m);
      return `${name} ${c.v} ${c.u}${c.per ? `/${c.per} ml` : ''}${RELEASE[c.r]}`;
    })
    .join(' + ');
}
