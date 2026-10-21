import { useEffect, useState } from 'preact/hooks';
import { saving } from '../match/equivalence';
import { prescriptionRows, splitPrescription, type RxRow } from '../match/rx';
import { search, type Index } from '../match/search';
import type { Hit } from '../match/types';
import { compositionText, rupees } from '../format';
import { bridgeHealth, gemmaUrl, readLines, type BridgeHealth } from '../photo';
import { hitId } from '../store';
import type { Ctx } from './ctx';
import { Voice } from './Voice';

type Row = RxRow;

/**
 * Whole prescription at once: typed, pasted, spoken, read off a PRINTED prescription by Gemma (local),
 * or (beta, only if the bridge owner enabled it) read off a HANDWRITTEN one by Google Gemini.
 * Handwriting can be misread, so its lines are never added in bulk: each medicine needs its own tap.
 */
export function Prescription({ ctx, index, list, onAdd, onDone, onBack, initialPhoto }: {
  ctx: Ctx;
  /** a photo chosen from the home screen's Photo menu */
  initialPhoto?: { file: File; mode: 'printed' | 'handwritten' } | null;
  index: Index;
  list: string[];
  onAdd: (hits: Hit[]) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t } = ctx;
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ignored, setIgnored] = useState(0);
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, handwriting: false });
  const [reading, setReading] = useState(false);
  const [handwritten, setHandwritten] = useState(false);
  const [source, setSource] = useState<'typed' | 'printed' | 'handwritten'>('typed');
  const [hwFailed, setHwFailed] = useState(false);
  const [lastPrinted, setLastPrinted] = useState<File | null>(null);

  useEffect(() => {
    const url = gemmaUrl();
    if (url) bridgeHealth(url).then(setHealth);
    if (initialPhoto) onPhoto(initialPhoto.file, initialPhoto.mode);
  }, []);

  // After a photo, keep skipping non-medicine lines even when the patient edits the text and checks again.
  const check = (src = text, fromPhoto = source !== 'typed') => {
    const { rows: keep, ignored: skipped } = prescriptionRows(src, index, fromPhoto);
    setIgnored(skipped);
    setRows(keep);
  };

  const onPhoto = async (file?: File, mode: 'printed' | 'handwritten' | 'gemini' = 'printed') => {
    if (!file) return;
    if (mode === 'printed') setLastPrinted(file);
    setReading(true);
    setHandwritten(false);
    setHwFailed(false);
    try {
      const lines = await readLines(file, mode === 'handwritten' ? 1600 : 1400, mode);
      const joined = lines.join('\n');
      setSource(mode === 'handwritten' ? 'handwritten' : 'printed');
      setText(joined);
      check(joined, true);
      const nothing = !lines.length || splitPrescription(joined).every((l) => search(index, l).kind === 'none');
      if (nothing) (mode === 'handwritten' ? setHwFailed : setHandwritten)(true);
    } catch {
      (mode === 'handwritten' ? setHwFailed : setHandwritten)(true);
    } finally {
      setReading(false);
    }
  };

  const matched = (rows ?? []).flatMap((r) => (r.result.kind === 'match' ? [r.result.hit] : []));
  const toAdd = source === 'handwritten' ? [] : matched.filter((h) => !list.includes(hitId(h)));

  return (
    <section class="card">
      <h2 class="card-title">{t.rxTitle}</h2>
      <p class="muted small pre">{t.rxHint}</p>
      <textarea
        class="rx-input"
        rows={5}
        value={text}
        placeholder={'Dolo 650 1-0-1\nPan 40 before breakfast\nTelma H 40'}
        onInput={(e) => { const v = (e.target as HTMLTextAreaElement).value; setText(v); if (!v.trim()) setSource('typed'); }}
      />
      <Voice ctx={ctx} onText={(s) => { const next = text ? `${text}\n${s}` : s; setText(next); check(next); }} />
      {health.ok && (
        <label class="big secondary as-button">
          📷 {reading ? t.photoReading : t.rxPhoto}
          <input type="file" accept="image/*" capture="environment" hidden disabled={reading}
            onChange={(e) => onPhoto((e.target as HTMLInputElement).files?.[0], 'printed')} />
        </label>
      )}
      {health.handwriting ? (
        <label class="big secondary as-button">
          ✍️ {reading ? t.photoReading : t.hwButton}
          <input type="file" accept="image/*" capture="environment" hidden disabled={reading}
            onChange={(e) => onPhoto((e.target as HTMLInputElement).files?.[0], 'handwritten')} />
        </label>
      ) : (
        <p class="muted small">✍️ {t.rxHandwriting}</p>
      )}
      <button class="big primary" onClick={() => check()} disabled={!text.trim()}>{t.rxCheck}</button>

      {handwritten && health.handwriting && lastPrinted ? (
        <div class="consent">
          <b>{t.fallbackTitleRx}</b>
          <div class="row">
            <button class="big primary" onClick={() => { const f = lastPrinted; setLastPrinted(null); onPhoto(f, 'gemini'); }}>{t.fallbackGo}</button>
            <button class="big secondary" onClick={() => setHandwritten(false)}>{t.cancel}</button>
          </div>
        </div>
      ) : handwritten && <p class="warn">{t.rxHandwriting}</p>}
      {hwFailed && <p class="warn">{t.hwFailed}</p>}
      {source === 'handwritten' && rows && <p class="warn">⚠ {t.hwWarn}</p>}
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
      <button class="big secondary" onClick={onBack}>← {t.back}</button>
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
        <div class="rx-line">“{row.line}”{row.line.includes('[?]') && <span class="unclear"> · {t.hwUnclear}</span>}</div>
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
    : row.line.includes('[?]') ? t.hwTypeIt : t.notFound;
  return (
    <li class="rx-row no">
      <div class="rx-line">“{row.line}”</div>
      <div class="muted">✗ {msg}</div>
    </li>
  );
}
