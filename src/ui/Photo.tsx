import { useEffect, useState } from 'preact/hooks';
import type { Index } from '../match/search';
import type { Hit } from '../match/types';
import { bridgeHealth, gemmaUrl, readStrip, type BridgeHealth } from '../photo';
import type { Ctx } from './ctx';

/**
 * Optional: photograph a printed strip/box. Gemma 4 (on the user's own laptop/server) only transcribes
 * the printed text and picks one of OUR candidates; our matcher and data decide everything shown.
 * Hidden when no Gemma server is configured — typing always works.
 */
export function Photo({ ctx, index, onFound }: { ctx: Ctx; index: Index; onFound: (h: Hit) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'confirm' | 'failed'>('idle');
  const [seen, setSeen] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<Hit | null>(null);
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, handwriting: false });
  const [file, setFile] = useState<File | null>(null);
  const [reader, setReader] = useState<'printed' | 'gemini'>('printed');
  const [offer, setOffer] = useState(false);
  const { t } = ctx;
  useEffect(() => {
    const url = gemmaUrl();
    if (url) bridgeHealth(url).then(setHealth);
  }, []);
  if (!health.ok) return null;
  // Gemini fallback is offered only if the bridge owner enabled it, and only after Gemma tried first.
  const canFallback = health.handwriting && reader === 'printed' && file !== null;

  const onFile = async (f: File | undefined, mode: 'printed' | 'gemini' = 'printed') => {
    if (!f) return;
    setFile(f);
    setReader(mode);
    setOffer(false);
    setState('busy');
    try {
      const r = await readStrip(f, index, mode);
      setSeen(r.lines);
      if (r.hit) {
        setCandidate(r.hit);
        setState('confirm');
      } else setState('failed');
    } catch {
      setState('failed');
    }
  };

  return (
    <div class="photo">
      <label class="tile photo-btn">
        <span class="tile-icon" aria-hidden="true">📷</span>{state === 'busy' ? t.photoReading : t.tilePhoto}
        <input type="file" accept="image/*" capture="environment" hidden disabled={state === 'busy'}
          onChange={(e) => onFile((e.target as HTMLInputElement).files?.[0])} />
      </label>
      {state === 'confirm' && candidate && (
        <div class="card confirm">
          <p class="muted small">{reader === 'gemini' ? t.readByGemini : t.readByGemma} · {t.photoSeen}: “{seen.slice(0, 4).join(' · ')}”</p>
          <h2 class="card-title">{t.photoConfirm}</h2>
          <p class="choice-title">{candidate.type === 'brand' ? candidate.brand.name : candidate.group.items[0].name}</p>
          <div class="row">
            <button class="big primary" onClick={() => { onFound(candidate); setState('idle'); }}>{t.yes}</button>
            <button class="big secondary" onClick={() => (canFallback ? setOffer(true) : setState('idle'))}>{t.noType}</button>
          </div>
        </div>
      )}
      {canFallback && (offer || state === 'failed') && (
        <div class="consent">
          <b>{t.fallbackTitle}</b>
          <p class="small">{t.fallbackBody}</p>
          <div class="row">
            <button class="big primary" onClick={() => onFile(file ?? undefined, 'gemini')}>{t.fallbackGo}</button>
            <button class="big secondary" onClick={() => { setOffer(false); setState('idle'); }}>{t.cancel}</button>
          </div>
        </div>
      )}
      {state === 'failed' && !canFallback && (
        <p class="warn">
          {t.photoFailed}
          {seen.length > 0 && <span class="muted small"> ({t.photoSeen}: “{seen.slice(0, 3).join(' · ')}”)</span>}
        </p>
      )}
    </div>
  );
}
