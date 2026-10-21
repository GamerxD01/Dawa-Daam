import { saving, perUnit } from '../match/equivalence';
import type { Brand, Hit } from '../match/types';
import { compositionText, rupees } from '../format';
import type { Ctx } from './ctx';

export function ResultCard({ hit, ctx, inList, onToggle }: { hit: Hit; ctx: Ctx; inList: boolean; onToggle: () => void }) {
  const { t } = ctx;
  if (hit.type === 'brand') {
    const b = hit.brand;
    const comp = compositionText(b.comp, ctx.molecules, ctx.lang);
    if (!hit.group) {
      return (
        <article class="card">
          <h2 class="card-title">{b.name}</h2>
          <p class="contains"><span>{t.contains}:</span> {comp}</p>
          <p class="nomatch">{t.noExact}</p>
          <p class="muted">{t.noExactWhy}</p>
          <p class="brand-only">{t.brandPrice}: <b>{rupees(b.mrp)}</b> {t.forPack(b.pack, t.units[b.form])}</p>
          <Source b={b} ctx={ctx} />
        </article>
      );
    }
    const s = saving(b, hit.group);
    return (
      <article class="card" aria-live="polite">
        <h2 class="card-title">{b.name} <small>{t.forPack(b.pack, t.units[b.form])}</small></h2>
        <div class="headline" aria-label={`${t.brandPrice} ${rupees(s.brandPrice)}, ${t.jaPrice} ${rupees(s.genericPrice)}`}>
          <span class="old">{rupees(s.brandPrice)}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="new">{rupees(s.genericPrice)}</span>
        </div>
        <p class="save">
          {t.youSave} <b>{rupees(s.saving)}</b> <span class="pct">({s.pct}%)</span>
        </p>
        <p class="contains"><span>{t.contains}:</span> {comp}</p>
        <p class="same">✓ {t.sameMedicine}</p>
        <div class="ja">
          <div class="ja-label">{t.janAushadhi} · {t.code} {s.generic.code}</div>
          <div class="ja-name">{s.generic.name}</div>
          <div class="ja-price">
            {rupees(s.generic.mrp)} {t.forPack(s.generic.pack, t.units[s.generic.form])} · {rupees(round(s.genericPerUnit))} {t.perUnit} {t.unit1[b.form]}
            <span class="vs"> ({t.brandPrice}: {rupees(round(s.brandPerUnit))} {t.perUnit} {t.unit1[b.form]})</span>
          </div>
        </div>
        {!b.verified && <p class="warn">⚠ {t.unverified}</p>}
        <button class={`big ${inList ? 'secondary' : 'primary'}`} onClick={onToggle}>
          {inList ? t.added : `＋ ${t.add}`}
        </button>
        <Source b={b} ctx={ctx} />
      </article>
    );
  }

  // A molecule search: show the Jan Aushadhi product, and any brands we know with the same composition.
  const g = hit.group.items[0];
  return (
    <article class="card" aria-live="polite">
      <h2 class="card-title">{compositionText(hit.group.comp, ctx.molecules, ctx.lang)}</h2>
      <div class="headline single">
        <span class="new">{rupees(g.mrp)}</span>
      </div>
      <p class="save">{t.jaPrice} · {t.forPack(g.pack, t.units[g.form])} · {rupees(round(perUnit(g)))} {t.perUnit} {t.unit1[g.form]}</p>
      <div class="ja">
        <div class="ja-label">{t.janAushadhi} · {t.code} {g.code}</div>
        <div class="ja-name">{g.name}</div>
      </div>
      {hit.brands.length > 0 && (
        <div class="brands">
          <div class="ja-label">{t.brandsInData}</div>
          <ul>
            {hit.brands.map((b) => {
              const s = saving(b, hit.group);
              return (
                <li key={b.id}>
                  <b>{b.name}</b>: <span class="old small">{rupees(s.brandPrice)}</span> → <b class="newc">{rupees(s.genericPrice)}</b>{' '}
                  <span class="muted">({t.forPack(b.pack, t.units[b.form])}, −{s.pct}%)</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button class={`big ${inList ? 'secondary' : 'primary'}`} onClick={onToggle}>
        {inList ? t.added : `＋ ${t.add}`}
      </button>
      <p class="source muted">{t.indicative} · {t.source}: PMBI (Jan Aushadhi) product list · {t.dataAsOf} {ctx.version}</p>
    </article>
  );
}

function Source({ b, ctx }: { b: Brand; ctx: Ctx }) {
  const host = (() => {
    try {
      return new URL(b.source).hostname.replace(/^www\./, '');
    } catch {
      return b.source;
    }
  })();
  return (
    <p class="source muted">
      {ctx.t.indicative} · {ctx.t.source}: <a href={b.source} target="_blank" rel="noopener noreferrer">{host}</a> ({b.captured}), PMBI · {b.maker}
    </p>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
