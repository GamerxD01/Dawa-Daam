import { describe, expect, it } from 'vitest';
import { haversineKm, overpassQuery, parseOverpass } from './kendra';

describe('nearest Jan Aushadhi Kendra (OpenStreetMap)', () => {
  it('computes distances', () => {
    // Connaught Place → India Gate, Delhi ≈ 2.4 km
    expect(haversineKm({ lat: 28.6315, lon: 77.2167 }, { lat: 28.6129, lon: 77.2295 })).toBeCloseTo(2.4, 0);
  });

  it('builds a bounded Overpass query around the user', () => {
    const q = overpassQuery(26.85, 80.95);
    expect(q).toContain('around:15000,26.85,80.95');
    expect(q).toMatch(/out center tags 50/);
  });

  it('parses nodes and buildings, dedupes and sorts by distance', () => {
    const here = { lat: 26.85, lon: 80.95 };
    const r = parseOverpass({
      elements: [
        { type: 'way', id: 2, center: { lat: 26.9, lon: 80.95 }, tags: { name: 'PMBJK Aliganj', 'addr:city': 'Lucknow' } },
        { type: 'node', id: 1, lat: 26.851, lon: 80.951, tags: { name: 'Jan Aushadhi Kendra', 'addr:street': 'Station Road', phone: '+91 1234' } },
        { type: 'node', id: 1, lat: 26.851, lon: 80.951, tags: { name: 'duplicate' } },
        { type: 'node', id: 3, tags: { name: 'no coordinates' } },
      ],
    }, here);
    expect(r.map((k) => k.name)).toEqual(['Jan Aushadhi Kendra', 'PMBJK Aliganj']);
    expect(r[0].km).toBeLessThan(0.2);
    expect(r[0].address).toBe('Station Road');
    expect(r[1].km).toBeCloseTo(5.6, 0);
  });
});
