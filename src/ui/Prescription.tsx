import { useEffect, useState } from 'preact/hooks';
import { saving } from '../match/equivalence';
import { prescriptionRows, splitPrescription, type RxRow } from '../match/rx';
import { search, type Index } from '../match/search';
import type { Hit } from '../match/types';
import { compositionText, rupees } from '../format';
import { gemmaAvailable, gemmaUrl, readLines } from '../photo';
import { hitId } from '../store';
import type { Ctx } from './ctx';
import { Voice } from './Voice';

type Row = RxRow;

/** Whole prescription at once: typed, pasted, spoken, or read off a PRINTED prescription by Gemma. */
export function Prescription({ ctx, index, list, onAdd, onDone }: {
  ctx: Ctx;
  index: Index;
  list: string[];
  onAdd: (hits: Hit[]) => void;
  onDone: () => void;
}) {
  const { t } = ctx;
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ignored, setIgnored] = useState(0);
  const [gemma, setGemma] = useState(false);
  const [reading, setReading] = useState(false);
  const [handwritten, setHandwritten] = useState(false);

  useEffect(() => {
    const url = gemmaUrl();
    if (url) gemmaAvailable(url).then(setGemma);
  }, []);

  const check = (src = text, fromPhoto = false) => {
    const { rows: keep, ignored: skipped } = prescriptionRows(src, index, fromPhoto);
    setIgnored(skipped);
    setRows(keep);
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setHandwritten(false);
    try {
      const lines = await readLines(file, 1400);
      const joined = lines.join('\n');
      setText(joined);
      check(joined, true);
      if (!lines.length || splitPrescription(joined).every((l) => search(index, l).kind === 'none')) setHandwritten(true);
    } catch {
      setHandwritten(true);
    } finally {
      setReading(false);
    }
  };

  const matched = (rows ?? []).flatMap((r) => (r.result.kind === 'match' ? [r.result.hit] : []));
  const toAdd = matched.filter((h) => !list.includes(hitId(h)));

  return (
    <section class="card">
      <h2 class="card-title">{t.rxTitle}</h2>
      <p class="muted small pre">{t.rxHint}</p>
      <textarea
        class="rx-input"
        rows={5}
        value={text}
        placeholder={'Dolo 650 1-0-1\nPan 40 before breakfast\nTelma H 40'}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      <Voice ctx={ctx} onText={(s) => { const next = text ? `${text}\n${s}` : s; setText(next); check(next); }} />
      {gemma && (
        <label class="big secondary as-button">
          📷 {reading ? t.photoReading : t.rxPhoto}
          <input type="file" accept="image/*" capture="environment" hidden disabled={reading}
            onChange={(e) => onPhoto((e.target as HTMLInputElement).files?.[0])} />
        </label>
      )}
      <p class="muted small">✍️ {t.rxHandwriting}</p>
      <button class="big primary" onClick={() => check()} disabled={!text.trim()}>{t.rxCheck}</button>

      {handwritten && <p class="warn">{t.rxHandwriting}</p>}
      {rows && (
        <>
          <ul class="rx-rows">
            {rows.map((r, i) => <RxRow key={i} row={r} ctx={ctx} list={list} onAdd={(h) => onAdd([h])} />)}
          </ul>
          {ignored > 0 && <p class="muted small">{t.rxIgnored(ignored)}</p>}
          {toAdd.length > 0 && (
            <button class="big primary" onClick={() => { onAdd(toAdd); onDone(); }}>{t.rxAddAll(toAdd.length)}</button>
          )}
        </>
      )}
      <p class="warn small">⚠ {t.rxNotJudge}</p>
      <button class="big secondary" onClick={onDone}>← {t.back}</button>
    </section>
  );
}

function RxRow({ row, ctx, list, onAdd }: { row: Row; ctx: Ctx; list: string[]; onAdd: (h: Hit) => void }) {
  const { t } = ctx;
  const r = row.result;
  if (r.kind === 'match') {
    const h = r.hit;
    const added = list.includes(hitId(h));
    let price = '';
    if (h.type === 'brand' && h.group) {
      const s = saving(h.brand, h.group);
      price = `${rupees(s.brandPrice)} → ${rupees(s.genericPrice)} (−${s.pct}%)`;
    } else if (h.type === 'brand') price = t.noMatchInList;
    else price = `${t.janAushadhi} ${rupees(h.group.items[0].mrp)}`;
    return (
      <li class="rx-row ok">
        <div class="rx-line">“{row.line}”</div>
        <div><b>✓ {h.type === 'brand' ? h.brand.name : compositionText(h.group.comp)}</b> · {price}</div>
        {added ? <span class="muted small">{t.added}</span> : <button class="link" onClick={() => onAdd(h)}>＋ {t.add}</button>}
      </li>
    );
  }
  if (r.kind === 'didyoumean' || r.kind === 'strength') {
    return (
      <li class="rx-row ask">
        <div class="rx-line">“{row.line}” · {r.kind === 'strength' ? t.chooseStrength : t.rxPick}</div>
        <div class="rx-chips">
          {r.hits.slice(0, 3).map((h) => (
            <button key={hitId(h)} class="chip" onClick={() => onAdd(h)}>
              {list.includes(hitId(h)) ? '✓ ' : '＋ '}{h.type === 'brand' ? h.brand.name : compositionText(h.group.comp)}
            </button>
          ))}
        </div>
      </li>
    );
  }
  const msg = r.kind === 'none' && r.reason === 'strength-unavailable'
    ? t.strengthNotFound(r.name ?? '', r.requested?.join(' / ') ?? '')
    : t.notFound;
  return (
    <li class="rx-row no">
      <div class="rx-line">“{row.line}”</div>
      <div class="muted">✗ {msg}</div>
    </li>
  );
}
