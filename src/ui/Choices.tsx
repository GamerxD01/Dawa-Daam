import type { Hit, SearchResult } from '../match/types';
import { compositionText, rupees } from '../format';
import type { Ctx } from './ctx';

/** "Did you mean", strength chooser and not-found states. Big tap targets, never a silent guess. */
export function Choices({ result, ctx, onPick, onNone }: {
  result: Exclude<SearchResult, { kind: 'empty' } | { kind: 'match' }>;
  ctx: Ctx;
  onPick: (h: Hit) => void;
  onNone: () => void;
}) {
  const { t } = ctx;
  if (result.kind === 'none') {
    return (
      <section class="card notfound" aria-live="polite">
        {result.reason === 'strength-unavailable' ? (
          <>
            <h2 class="card-title">{t.strengthNotFound(result.name ?? '', result.requested?.join(' / ') ?? '')}</h2>
            {result.near.length > 0 && <p class="muted">{t.strengthNearHelp}</p>}
            <div class="choices">{result.near.map((h) => <ChoiceButton key={key(h)} hit={h} ctx={ctx} onPick={onPick} />)}</div>
          </>
        ) : (
          <>
            <h2 class="card-title">{t.notFound}</h2>
            <p class="muted">{t.notFoundHelp}</p>
            {result.near.length > 0 && (
              <>
                <p class="muted">{t.didYouMean}</p>
                <div class="choices">{result.near.map((h) => <ChoiceButton key={key(h)} hit={h} ctx={ctx} onPick={onPick} />)}</div>
              </>
            )}
            <a class="link" href="https://github.com/GamerxD01/Dawa-Daam/issues/new?template=add-medicine.yml" target="_blank" rel="noopener noreferrer">
              {t.requestIt} ↗
            </a>
          </>
        )}
      </section>
    );
  }
  const heading = result.kind === 'strength' ? t.chooseStrength : t.didYouMean;
  return (
    <section class="card" aria-live="polite">
      <h2 class="card-title">{heading}</h2>
      <div class="choices">
        {result.hits.map((h) => <ChoiceButton key={key(h)} hit={h} ctx={ctx} onPick={onPick} />)}
        <button class="choice ghost" onClick={onNone}>{t.noneOfThese}</button>
      </div>
    </section>
  );
}

function ChoiceButton({ hit, ctx, onPick }: { hit: Hit; ctx: Ctx; onPick: (h: Hit) => void }) {
  const title = hit.type === 'brand' ? hit.brand.name : compositionText(hit.group.comp);
  const sub =
    hit.type === 'brand'
      ? compositionText(hit.brand.comp)
      : `${ctx.t.janAushadhi} · ${hit.group.items[0].name} · ${rupees(hit.group.items[0].mrp)}`;
  return (
    <button class="choice" onClick={() => onPick(hit)}>
      <span class="choice-title">{title}</span>
      <span class="choice-sub">{sub}</span>
    </button>
  );
}

const key = (h: Hit) => (h.type === 'brand' ? h.brand.id : h.group.key);
