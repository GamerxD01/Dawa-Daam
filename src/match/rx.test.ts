import { describe, expect, it } from 'vitest';
import raw from '../generated/drugs.json';
import { cleanRxLine, prescriptionRows, splitPrescription } from './rx';
import { buildIndex, search } from './search';
import type { DrugData } from './types';

const index = buildIndex(raw as unknown as DrugData);

describe('whole prescription', () => {
  it('drops numbering and dosage instructions without interpreting them', () => {
    expect(cleanRxLine('1. Tab. Dolo 650  1-0-1 x 5 days after food')).toBe('Tab. Dolo 650');
    expect(cleanRxLine('2) Pan 40 OD before breakfast')).toBe('Pan 40');
    expect(cleanRxLine('• Telma H 40 once daily morning')).toBe('Telma H 40');
    expect(cleanRxLine('Rx Augmentin 625 BD for 5 days')).toBe('Augmentin 625');
  });

  it('splits lines and commas but keeps combinations together', () => {
    expect(splitPrescription('Dolo 650, Pan 40\nAmoxicillin + Clavulanic acid 625; Shelcal')).toEqual([
      'Dolo 650', 'Pan 40', 'Amoxicillin + Clavulanic acid 625', 'Shelcal',
    ]);
  });

  it('ignores lines with no medicine name (dates, signatures, advice)', () => {
    expect(splitPrescription('21/10/2026\n1-0-1\n\nDolo 650')).toEqual(['Dolo 650']);
  });

  it('a typical printed prescription resolves line by line', () => {
    const rx = `1. Tab Telma H 40   1-0-0  x 30 days
2. Tab Glycomet GP 1   1-0-1 after food
3. Cap Pan D   1-0-0 before breakfast
4. Tab Rosuvas 10  0-0-1`;
    const kinds = splitPrescription(rx).map((l) => {
      const r = search(index, l);
      return r.kind === 'match' && r.hit.type === 'brand' ? r.hit.brand.name : r.kind;
    });
    expect(kinds).toEqual(['Telma H', 'Glycomet GP 1', 'Pan D', 'Rosuvas 10']);
  });

  const label = (r: ReturnType<typeof prescriptionRows>['rows'][number]) =>
    r.result.kind === 'match' && r.result.hit.type === 'brand' ? r.result.hit.brand.name : `${r.result.kind}:${r.line}`;

  // Text as Gemma might return it for docs/samples/sample-printed-prescription.jpg, read row by row…
  it('photo of a printed prescription, read row by row', () => {
    const lines = [
      'Dr. Sample Physician', 'MBBS, MD (General Medicine) · Reg. No. TEST-00000', 'Demo Clinic', 'Test Road, Sample City',
      'Patient: Test Patient Age/Sex: 58/M', 'Date: 21/10/2026', 'Diagnosis: Hypertension, Type 2 Diabetes, Acidity',
      'Medicine Dose Duration',
      '1. Tab. Telma H 40 1-0-0 x 30 days', '2. Tab. Glycomet GP 1 1-0-1 after food x 30 days',
      '3. Cap. Pan D 1-0-0 before breakfast x 15 days', '4. Tab. Rosuvas 10 0-0-1 x 30 days',
      '5. Tab. Shelcal 500 0-1-0 x 30 days', '6. Tab. Cardace 2.5 0-0-1 x 30 days',
      'Advice: Low salt diet. Walk 30 minutes daily. Review after 1 month with reports.', 'Signature',
    ];
    const { rows, ignored } = prescriptionRows(lines.join('\n'), index, true);
    expect(rows.map(label)).toEqual(['Telma H', 'Glycomet GP 1', 'Pan D', 'Rosuvas 10', 'Shelcal 500', 'none:Tab. Cardace 2.5']);
    expect(ignored).toBeGreaterThan(5);
  });

  // …or column by column (all names first, then the doses)
  it('photo of a printed prescription, read column by column', () => {
    const lines = ['Medicine', '1. Tab. Telma H 40', '2. Tab. Glycomet GP 1', '3. Cap. Pan D', '4. Tab. Rosuvas 10',
      '5. Tab. Shelcal 500', '6. Tab. Cardace 2.5', 'Dose', '1-0-0', '1-0-1 after food', '1-0-0 before breakfast', '0-0-1', 'x 30 days'];
    const { rows } = prescriptionRows(lines.join('\n'), index, true);
    expect(rows.map(label)).toEqual(['Telma H', 'Glycomet GP 1', 'Pan D', 'Rosuvas 10', 'Shelcal 500', 'none:Tab. Cardace 2.5']);
  });
});
