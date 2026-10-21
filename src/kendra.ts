// Nearest Jan Aushadhi Kendra from OpenStreetMap (open data, no API key).
// Runs only when the user asks and allows location; needs internet. The rest of the app stays offline.

export interface Kendra {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  phone?: string;
  hours?: string;
  km: number;
}

const NAME_PATTERN = 'aushadhi|aushadi|janaushadhi|jan aushadhi|pmbjk|pmbjp|jan ausadhi';

export function overpassQuery(lat: number, lon: number, radiusM = 15000): string {
  return `[out:json][timeout:20];
(
  nwr["name"~"${NAME_PATTERN}",i](around:${radiusM},${lat},${lon});
  nwr["brand"~"${NAME_PATTERN}",i](around:${radiusM},${lat},${lon});
  nwr["operator"~"${NAME_PATTERN}",i](around:${radiusM},${lat},${lon});
);
out center tags 50;`;
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(json: { elements?: OsmElement[] }, here: { lat: number; lon: number }): Kendra[] {
  const seen = new Set<string>();
  const out: Kendra[] = [];
  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = el.tags ?? {};
    const address = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] ?? t['addr:place'], t['addr:city'], t['addr:postcode']]
      .filter(Boolean).join(', ');
    out.push({
      id,
      name: t.name ?? t.brand ?? 'Jan Aushadhi Kendra',
      lat,
      lon,
      address,
      phone: t.phone ?? t['contact:phone'],
      hours: t.opening_hours,
      km: Math.round(haversineKm(here, { lat, lon }) * 10) / 10,
    });
  }
  return out.sort((a, b) => a.km - b.km);
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function findKendras(lat: number, lon: number): Promise<Kendra[]> {
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: overpassQuery(lat, lon) }), signal: ctl.signal });
      clearTimeout(timer);
      if (r.ok) return parseOverpass(await r.json(), { lat, lon });
      lastErr = new Error(`overpass ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export const directionsUrl = (k: { lat: number; lon: number }) =>
  `https://www.openstreetmap.org/directions?route=;${k.lat}%2C${k.lon}#map=16/${k.lat}/${k.lon}`;

export const googleMapsSearch = (lat?: number, lon?: number) =>
  `https://www.google.com/maps/search/Jan+Aushadhi+Kendra${lat !== undefined ? `/@${lat},${lon},13z` : ''}`;
