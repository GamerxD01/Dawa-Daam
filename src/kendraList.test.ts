import { describe, expect, it } from 'vitest';
import file from '../public/data/kendras.json';
import { expand, searchKendras, type KendraFile } from './kendraList';

const list = expand(file as unknown as KendraFile);

describe.skipIf(list.length === 0)('official Kendra list', () => {
  it('has the whole Uttar Pradesh list, without operator names', () => {
    expect(list.length).toBeGreaterThan(4000);
    expect(new Set(list.map((k) => k.district)).size).toBe(75);
    expect(Object.keys(list[0]).sort()).toEqual(['address', 'code', 'district', 'pin', 'state']);
  });
  it('a PIN code gives that PIN first, then the nearest PINs in the area', () => {
    const r = searchKendras(list, '226024');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].pin).toBe('226024');
    expect(r.every((k) => k.pin.startsWith('226'))).toBe(true);
  });
  it('a district name finds that district', () => {
    const r = searchKendras(list, 'lucknow');
    expect(r.length).toBe(30);
    expect(r.every((k) => k.district === 'Lucknow')).toBe(true);
  });
  it('district + area puts Kendras whose address mentions the area first', () => {
    const r = searchKendras(list, 'lucknow aliganj');
    expect(r[0].address.toLowerCase()).toContain('aliganj');
  });
  it('nothing for nonsense', () => {
    expect(searchKendras(list, 'zzqx')).toEqual([]);
  });
});
