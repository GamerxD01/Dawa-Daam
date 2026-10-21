import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import raw from './generated/drugs.json';
import { strings, type Lang } from './i18n';
import { buildIndex, search } from './match/search';
import type { DrugData, Hit } from './match/types';
import { hitId, load, save } from './store';
import { Basket, lineFor } from './ui/Basket';
import { Choices } from './ui/Choices';
import type { Ctx } from './ui/ctx';
import { Photo } from './ui/Photo';
import { Kendras } from './ui/Kendras';
import { Prescription } from './ui/Prescription';
import { Voice } from './ui/Voice';
import { ResultCard } from './ui/ResultCard';
import { Sheet } from './ui/Sheet';

const data = raw as unknown as DrugData;
const index = buildIndex(data);
const molecules = new Map(data.molecules.map((m) => [m.name, m]));
const byId = new Map(index.entries.map((e) => [hitId({ ...e.hit, score: 1 } as Hit), { ...e.hit, score: 1 } as Hit]));

type View = 'search' | 'list' | 'sheet' | 'rx' | 'rx-hw' | 'kendra';

export function App() {
  const [lang, setLang] = useState<Lang>(() => load<Lang>('lang', 'hi'));
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Hit | null>(null);
  const [view, setView] = useState<View>('search');
  const [list, setList] = useState<string[]>(() => load<string[]>('list', []).filter((id) => byId.has(id)));
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const input = useRef<HTMLInputElement>(null);
  const [rxPhoto, setRxPhoto] = useState<{ file: File; mode: 'printed' | 'handwritten' } | null>(null);

  useEffect(() => save('lang', lang), [lang]);
  useEffect(() => save('list', list), [list]);
  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);

  const t = strings[lang];
  const ctx: Ctx = { t, lang, molecules, version: data.version };
  const result = useMemo(() => search(index, query), [query]);
  const shown: Hit | null = picked ?? (result.kind === 'match' ? result.hit : null);
  const lines = list.map((id) => lineFor(byId.get(id)!));

  const toggle = (h: Hit) => {
    const id = hitId(h);
    setList((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };
  const reset = () => {
    setQuery('');
    setPicked(null);
    input.current?.focus();
  };

  if (view === 'sheet') return <Sheet lines={lines} ctx={ctx} onBack={() => setView('list')} />;

  return (
    <div class="app">
      <header class="top">
        <div>
          <h1 class="brand">{t.app}</h1>
          <p class="tagline">{t.tagline}</p>
        </div>
        <div class="lang" role="group" aria-label="Language">
          <button aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>हिं</button>
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        </div>
      </header>

      {!online && <p class="offline">● {t.offline}</p>}

      <main>
        {view === 'kendra' ? (
          <Kendras ctx={ctx} onBack={() => setView('search')} />
        ) : view === 'rx' || view === 'rx-hw' ? (
          <Prescription key={rxPhoto ? rxPhoto.file.name + rxPhoto.file.lastModified : view} ctx={ctx} index={index} list={list}
            startHandwritten={view === 'rx-hw'} initialPhoto={rxPhoto}
            onAdd={(hits) => setList((l) => [...l, ...hits.map(hitId).filter((id) => !l.includes(id))])}
            onDone={() => setView('list')} onBack={() => setView('search')} />
        ) : view === 'list' ? (
          <Basket lines={lines} ctx={ctx} onRemove={toggle} onSheet={() => setView('sheet')} onBack={() => setView('search')} onKendra={() => setView('kendra')} />
        ) : (
          <>
            <label class="search">
              <span class="search-label">{t.searchLabel}</span>
              <div class="search-row">
                <input
                  ref={input}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellcheck={false}
                  placeholder={t.searchHint}
                  value={query}
                  onInput={(e) => {
                    setQuery((e.target as HTMLInputElement).value);
                    setPicked(null);
                  }}
                />
                {query && <button class="clear" aria-label={t.clear} onClick={reset}>×</button>}
              </div>
            </label>

            <div class="tools" role="group">
              <Voice ctx={ctx} compact onText={(s) => { setQuery(s); setPicked(null); }} />
              <Photo ctx={ctx} index={index}
                onFound={(h) => { setPicked(h); setQuery(h.type === 'brand' ? h.brand.name : ''); }}
                onPrescriptionPhoto={(file, mode) => { setRxPhoto({ file, mode }); setView('rx'); }} />
              <button class="tile" onClick={() => { setRxPhoto(null); setView('rx'); }}><span class="tile-icon" aria-hidden="true">📝</span>{t.tileRx}</button>
              <button class="tile" onClick={() => setView('kendra')}><span class="tile-icon" aria-hidden="true">📍</span>{t.tileKendra}</button>
            </div>

            {shown ? (
              <ResultCard hit={shown} ctx={ctx} inList={list.includes(hitId(shown))} onToggle={() => toggle(shown)} onKendra={() => setView('kendra')} />
            ) : result.kind !== 'empty' && result.kind !== 'match' ? (
              <Choices result={result} ctx={ctx} onPick={setPicked} onNone={() => setPicked(null)} />
            ) : (
              <Examples onPick={(q) => { setQuery(q); setPicked(null); }} />
            )}
          </>
        )}
      </main>

      <footer class="bottom">
        <p class="disclaimer" role="note">⚠ {t.disclaimer}</p>
        {view === 'search' && (
          <button class="big list-btn" onClick={() => setView('list')}>
            🧾 {t.myList} ({list.length})
          </button>
        )}
      </footer>
    </div>
  );
}

function Examples({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div class="examples">
      {['Dolo 650', 'Pan 40', 'Telma H', 'Lyrica', 'Glycomet GP 1', 'Paracetamol 650'].map((q) => (
        <button key={q} class="chip" onClick={() => onPick(q)}>{q}</button>
      ))}
    </div>
  );
}
