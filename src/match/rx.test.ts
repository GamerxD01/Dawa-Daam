import { describe, expect, it } from 'vitest';
import raw from '../generated/drugs.json';
import { cleanRxLine, prescriptionRows, splitPrescription, unclearLine } from './rx';
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

  it('an unreadable word never gives a confident answer ("Pan [?] 40" could be Pan D)', () => {
    const r = unclearLine('Cap Pan [?] 40', index);
    expect(r.kind).toBe('didyoumean');
    const names = r.kind === 'didyoumean' ? r.hits.map((h) => (h.type === 'brand' ? h.brand.name : h.group.key)) : [];
    expect(names).toEqual(expect.arrayContaining(['Pan 40', 'Pan D']));
  });

  // Exactly what Gemini returned for the real handwritten prescription we demo
  it('real handwritten prescription: cyclosporine is found, unknown brands are not invented', () => {
    const { rows } = prescriptionRows(['Cap Cyclomune 50mg', 'Tab [?]', 'Tab Nypid 10', 'Cap Moyren'].join('\n'), index, true);
    const r0 = rows[0].result;
    expect(r0.kind === 'match' && r0.hit.type === 'brand' && r0.hit.brand.name).toBe('Cyclomune 50');
    expect(r0.kind === 'match' && r0.hit.type === 'brand' && r0.hit.otherForm?.items[0].code).toBe(850);
    expect(rows.slice(1).map((r) => r.result.kind)).toEqual(['none', 'none', 'none']);
  });

  // A handwritten demo prescription made only of medicines we carry
  it('demo handwritten prescription: every line matches', () => {
    const { rows } = prescriptionRows(['Tab Telma H 40', 'Cap Pan D', 'Tab Dolo 650', 'Tab Montair LC', 'Tab Shelcal 500'].join('\n'), index, true);
    expect(rows.map((r) => (r.result.kind === 'match' && r.result.hit.type === 'brand' ? r.result.hit.brand.name : r.result.kind)))
      .toEqual(['Telma H', 'Pan D', 'Dolo 650', 'Montair LC', 'Shelcal 500']);
  });

  // docs/samples/sample-prescription-2-*.jpg: six medicines, all in our data
  it('sample prescription 2: all six medicines match', () => {
    const lines = ['Dr. Demo Physician', 'Diagnosis: Type 2 Diabetes, Hypertension, Neuropathy, Allergic rhinitis',
      '1. Tab. Galvus Met 50/500 1-0-1 after food x 30 days', '2. Tab. Telma AM 1-0-0 x 30 days', '3. Cap. Lyrica 75 0-0-1 x 14 days',
      '4. Tab. Rozavel 10 0-0-1 x 30 days', '5. Tab. Montair LC 0-0-1 x 10 days', '6. Tab. Pantocid 40 1-0-0 before breakfast x 15 days',
      'Advice: Check sugar fasting and PP. Review after 2 weeks.'];
    const { rows } = prescriptionRows(lines.join('\n'), index, true);
    expect(rows.map(label)).toEqual(['Galvus Met 50/500', 'Telma AM', 'Lyrica 75', 'Rozavel 10', 'Montair LC', 'Pantocid 40']);
  });
});
