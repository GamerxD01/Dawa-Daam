import { saving } from '../match/equivalence';
import type { Hit } from '../match/types';
import { compositionText, rupees } from '../format';
import { hitId } from '../store';
import type { Ctx } from './ctx';

export interface Line {
  hit: Hit;
  /** what the patient pays for the brand (null for a molecule search: no brand price known) */
  brand: number | null;
  generic: number | null;
  label: string;
  genericLabel: string;
  code: number | null;
}

export function lineFor(hit: Hit): Line {
  if (hit.type === 'brand') {
    if (!hit.group) return { hit, brand: hit.brand.mrp, generic: null, label: hit.brand.name, genericLabel: '', code: null };
    const s = saving(hit.brand, hit.group);
    return { hit, brand: s.brandPrice, generic: s.genericPrice, label: hit.brand.name, genericLabel: s.generic.name, code: s.generic.code };
  }
  const g = hit.group.items[0];
  return { hit, brand: null, generic: g.mrp, label: compositionText(hit.group.comp), genericLabel: g.name, code: g.code };
}

export function totals(lines: Line[]) {
  // Only lines with both prices count towards the saving; nothing is estimated.
  const paired = lines.filter((l) => l.brand !== null && l.generic !== null);
  const brand = round(paired.reduce((s, l) => s + (l.brand ?? 0), 0));
  const generic = round(paired.reduce((s, l) => s + (l.generic ?? 0), 0));
  return { brand, generic, saving: round(brand - generic), pct: brand ? Math.round(((brand - generic) / brand) * 100) : 0 };
}

export function Basket({ lines, ctx, onRemove, onSheet, onBack, onKendra }: {
  lines: Line[];
  ctx: Ctx;
  onRemove: (h: Hit) => void;
  onSheet: () => void;
  onBack: () => void;
  onKendra: () => void;
}) {
  const { t } = ctx;
  const tot = totals(lines);
  return (
    <section class="card">
      <h2 class="card-title">{t.myList} ({lines.length})</h2>
      {lines.length === 0 && <p class="muted">{t.listEmpty}</p>}
      <ul class="lines">
        {lines.map((l) => (
          <li key={hitId(l.hit)}>
            <div class="line-main">
              <b>{l.label}</b>
              <span class="line-prices">
                {l.brand !== null && <span class="old small">{rupees(l.brand)}</span>}
                {l.generic !== null ? <b class="newc"> → {rupees(l.generic)}</b> : <span class="muted"> · {t.noMatchInList}</span>}
              </span>
            </div>
            {l.genericLabel && <div class="muted small">{t.janAushadhi} {l.code}: {l.genericLabel}</div>}
            <button class="link danger" onClick={() => onRemove(l.hit)}>{t.remove}</button>
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <div class="total">
          <div>{t.total}: <span class="old small">{rupees(tot.brand)}</span> → <b class="newc">{rupees(tot.generic)}</b></div>
          <div class="total-save">{t.totalSaving}: {rupees(tot.saving)} ({tot.pct}%)</div>
          <button class="big primary" onClick={onSheet}>🧾 {t.print}</button>
          <button class="big secondary" onClick={onKendra}>📍 {t.kendra}</button>
        </div>
      )}
      <button class="big secondary" onClick={onBack}>← {t.back}</button>
    </section>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
