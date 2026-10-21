import { useEffect, useState } from 'preact/hooks';
import type { Index } from '../match/search';
import type { Hit } from '../match/types';
import { gemmaAvailable, gemmaUrl, readStrip } from '../photo';
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
  const [available, setAvailable] = useState(false);
  const { t } = ctx;
  useEffect(() => {
    const url = gemmaUrl();
    if (url) gemmaAvailable(url).then(setAvailable);
  }, []);
  if (!available) return null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setState('busy');
    try {
      const r = await readStrip(file, index);
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
      <label class="big secondary as-button photo-btn">
        📷 {state === 'busy' ? t.photoReading : t.photo}
        <input type="file" accept="image/*" capture="environment" hidden disabled={state === 'busy'}
          onChange={(e) => onFile((e.target as HTMLInputElement).files?.[0])} />
      </label>
      {state === 'confirm' && candidate && (
        <div class="card confirm">
          <p class="muted small">{t.photoSeen}: “{seen.slice(0, 4).join(' · ')}”</p>
          <h2 class="card-title">{t.photoConfirm}</h2>
          <p class="choice-title">{candidate.type === 'brand' ? candidate.brand.name : candidate.group.items[0].name}</p>
          <div class="row">
            <button class="big primary" onClick={() => { onFound(candidate); setState('idle'); }}>{t.yes}</button>
            <button class="big secondary" onClick={() => setState('idle')}>{t.noType}</button>
          </div>
        </div>
      )}
      {state === 'failed' && (
        <p class="warn">
          {t.photoFailed}
          {seen.length > 0 && <span class="muted small"> ({t.photoSeen}: “{seen.slice(0, 3).join(' · ')}”)</span>}
        </p>
      )}
    </div>
  );
}
