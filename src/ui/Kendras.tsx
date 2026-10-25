import { useEffect, useRef, useState } from 'preact/hooks';
import { directionsUrl, findKendras, googleMapsSearch, type Kendra } from '../kendra';
import { loadKendras, mapsSearchUrl, searchKendras, type OfficialKendra } from '../kendraList';
import type { Ctx } from './ctx';

type State =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'searching' }
  | { s: 'denied' }
  | { s: 'offline' }
  | { s: 'error' }
  | { s: 'done'; here: { lat: number; lon: number }; list: Kendra[] };

/** Nearest Jan Aushadhi Kendras from OpenStreetMap, with a map (Leaflet, loaded only on this screen). */
export function Kendras({ ctx, onBack }: { ctx: Ctx; onBack: () => void }) {
  const { t } = ctx;
  const [st, setSt] = useState<State>({ s: 'idle' });
  const mapEl = useRef<HTMLDivElement>(null);

  const locate = () => {
    if (!navigator.onLine) return setSt({ s: 'offline' });
    if (!('geolocation' in navigator)) return setSt({ s: 'denied' });
    setSt({ s: 'locating' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setSt({ s: 'searching' });
        try {
          setSt({ s: 'done', here, list: await findKendras(here.lat, here.lon) });
        } catch {
          setSt({ s: 'error' });
        }
      },
      () => setSt({ s: 'denied' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  // Draw the map once results arrive. Leaflet is imported lazily so it never slows the main screen.
  useEffect(() => {
    if (st.s !== 'done' || !mapEl.current) return;
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapEl.current) return;
      map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const dot = (color: string) => ({ radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 });
      L.circleMarker([st.here.lat, st.here.lon], dot('#2563eb')).addTo(map).bindTooltip(t.kYou);
      const pts: [number, number][] = [[st.here.lat, st.here.lon]];
      st.list.slice(0, 15).forEach((k, i) => {
        L.circleMarker([k.lat, k.lon], dot('#0f5132')).addTo(map!).bindTooltip(`${i + 1}. ${k.name} · ${k.km} km`);
        pts.push([k.lat, k.lon]);
      });
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 15 });
      else map.setView(pts[0], 13);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [st]);

  const here = st.s === 'done' ? st.here : undefined;
  return (
    <section class="card">
      <h2 class="card-title">📍 {t.kendra}</h2>
      <OfficialSearch ctx={ctx} />

      <h3 class="k-sub">{t.kNearMe}</h3>
      <p class="muted small">{t.kWhy}</p>

      {(st.s === 'idle' || st.s === 'denied' || st.s === 'error' || st.s === 'offline') && (
        <button class="big primary" onClick={locate}>📍 {t.kFind}</button>
      )}
      {st.s === 'locating' && <p class="muted">{t.kLocating}</p>}
      {st.s === 'searching' && <p class="muted">{t.kSearching}</p>}
      {st.s === 'denied' && <p class="warn">{t.kDenied}</p>}
      {st.s === 'offline' && <p class="warn">{t.kOffline}</p>}
      {st.s === 'error' && <p class="warn">{t.kError}</p>}

      {st.s === 'done' && (
        <>
          <div class="map" ref={mapEl} role="img" aria-label={t.kendra} />
          {st.list.length === 0 ? (
            <p class="warn">{t.kNone}</p>
          ) : (
            <ol class="kendras">
              {st.list.slice(0, 15).map((k) => (
                <li key={k.id}>
                  <div class="k-name"><b>{k.name}</b> <span class="k-km">{k.km} km</span></div>
                  {k.address && <div class="muted small">{k.address}</div>}
                  {k.hours && <div class="muted small">🕒 {k.hours}</div>}
                  <div class="k-actions">
                    <a class="link" href={directionsUrl(k)} target="_blank" rel="noopener noreferrer">🧭 {t.kDirections}</a>
                    {k.phone && <a class="link" href={`tel:${k.phone.replace(/\s/g, '')}`}>📞 {t.kCall}</a>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p class="muted small">{t.kCoverage}</p>
        </>
      )}

      <a class="big secondary as-button" href={googleMapsSearch(here?.lat, here?.lon)} target="_blank" rel="noopener noreferrer">
        🔎 {t.kGoogle}
      </a>
      <button class="big secondary" onClick={onBack}>← {t.back}</button>
    </section>
  );
}

/** Offline search of the official Kendra list by PIN code, district or place. */
function OfficialSearch({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ list: OfficialKendra[]; states: string[]; date: string } | 'loading' | 'failed'>('loading');
  useEffect(() => {
    let alive = true;
    loadKendras(import.meta.env.BASE_URL, ctx.version)
      .then(({ list, file }) => alive && setData({ list, states: file.states, date: file.source.match(/\d{1,2} \w+ \d{4}/)?.[0] ?? '' }))
      .catch(() => alive && setData('failed'));
    return () => { alive = false; };
  }, []);
  const hits = typeof data === 'object' ? searchKendras(data.list, q) : [];
  return (
    <div class="k-official">
      <label class="search">
        <span class="search-label">{t.kOfficialLabel}</span>
        <div class="search-row">
          <input type="search" inputMode="text" autoComplete="postal-code" placeholder={t.kOfficialHint} value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        </div>
      </label>
      {data === 'loading' && <p class="muted small">{t.kOfficialLoading}</p>}
      {data === 'failed' && <p class="warn">{t.kOfficialFailed}</p>}
      {typeof data === 'object' && (
        <>
          <p class="muted small">{t.kOfficialAbout(data.list.length, data.states.join(', '), data.date)}</p>
          {q.trim() && hits.length === 0 && <p class="warn">{t.kOfficialNone}</p>}
          {hits.length > 0 && (
            <ol class="kendras">
              {hits.map((k) => (
                <li key={k.code}>
                  <div class="k-name"><b>{t.kendraName}</b> <span class="k-km">{k.code}</span></div>
                  <div class="muted small">{k.address || t.kNoAddress}</div>
                  <div class="small">{k.district} · {t.kPin} {k.pin}</div>
                  <div class="k-actions">
                    <a class="link" href={mapsSearchUrl(k)} target="_blank" rel="noopener noreferrer">🧭 {t.kOpenMap}</a>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
