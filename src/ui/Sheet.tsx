import { strings } from '../i18n';
import { rupees } from '../format';
import { hitId } from '../store';
import { totals, type Line } from './Basket';
import type { Ctx } from './ctx';

/** Bilingual sheet to hand across the counter. Printed via the browser (Save as PDF works too). */
export function Sheet({ lines, ctx, onBack }: { lines: Line[]; ctx: Ctx; onBack: () => void }) {
  const hi = strings.hi, en = strings.en;
  const tot = totals(lines);
  const date = new Date().toLocaleDateString('en-IN');
  const shareText = [
    `${en.sheetTitle} / ${hi.sheetTitle}`,
    ...lines.map((l) =>
      `• ${l.label}${l.brand !== null ? ` ${rupees(l.brand)}` : ''} → ${l.code ? `Jan Aushadhi ${l.code}: ${l.genericLabel} ${rupees(l.generic ?? 0)}` : en.noMatchInList}`),
    `${en.totalSaving}: ${rupees(tot.saving)} (${tot.pct}%)`,
    en.disclaimer,
  ].join('\n');

  return (
    <section class="sheet">
      <div class="no-print sheet-actions">
        <button class="big primary" onClick={() => window.print()}>🖨 {ctx.t.print}</button>
        <a class="big secondary as-button" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
          {ctx.t.share}
        </a>
        <button class="big secondary" onClick={onBack}>← {ctx.t.back}</button>
      </div>
      <div class="paper">
        <h1>{hi.sheetTitle} / {en.sheetTitle}</h1>
        <p class="muted">{hi.sheetFor} · {en.sheetFor} · {date}</p>
        <table>
          <thead>
            <tr>
              <th>{hi.colBrand}<br /><small>{en.colBrand}</small></th>
              <th>{hi.colGeneric}<br /><small>{en.colGeneric}</small></th>
              <th>{hi.colPrice}<br /><small>{en.colPrice}</small></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={hitId(l.hit)}>
                <td><b>{l.label}</b>{l.brand !== null && <div>{rupees(l.brand)}</div>}</td>
                <td>{l.code ? <>{l.genericLabel}<div><small>Jan Aushadhi code {l.code}</small></div></> : <i>{en.noMatchInList}</i>}</td>
                <td><b>{l.generic !== null ? rupees(l.generic) : '—'}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="sheet-total">
          {hi.totalSaving} / {en.totalSaving}: <b>{rupees(tot.saving)}</b> ({rupees(tot.brand)} → {rupees(tot.generic)})
        </p>
        <p class="sheet-disclaimer">⚠ {hi.disclaimer}<br />{en.disclaimer}</p>
        <p class="muted small">DawaDaam · {en.indicative} · {en.dataAsOf} {ctx.version} · github.com/GamerxD01/Dawa-Daam</p>
      </div>
    </section>
  );
}
