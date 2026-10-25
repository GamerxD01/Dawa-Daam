import { describe, expect, it } from 'vitest';
import { canonicalMolecule, compText } from './composition.mjs';
import { parseGenericName } from './pmbi.mjs';
import { importKaggle } from './kaggle.mjs';

const read = (name, form) => { const r = parseGenericName(name, form, new Map()); return r.comp ? compText(r.comp) : `skip: ${r.reason}`; };

describe('PMBI names → composition', () => {
  it.each([
    ['Aceclofenac 100mg and Paracetamol 325mg Tablets', 'tablet', 'aceclofenac:100mg|paracetamol:325mg'],
    ['Prednisolone Tablets IP 10 mg', 'tablet', 'prednisolone:10mg'],
    ['Pantoprazole 20mg (Gastro-resistant) and Domperidone 10mg (Prolonged Release) Capsules IP', 'capsule', 'domperidone:10mg:MR|pantoprazole:20mg:GR'],
    ['Metformin Hydrochloride Sustained Release Tablets IP 1000 mg', 'tablet', 'metformin:1000mg:MR'],
    ['Pantoprazole Tablets IP 40 mg', 'tablet', 'pantoprazole:40mg:GR'], // PPIs are always gastro-resistant
    ['Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP', 'tablet', 'sulphamethoxazole:800mg|trimethoprim:160mg'],
    ['Amlodipine + Enalapril Tablet (5/5 Mg)', 'tablet', 'amlodipine:5mg|enalapril:5mg'],
    ['Hydroxyzine Hydrochloride Syrup 10mg per 5ml', 'syrup', 'hydroxyzine:10mg/5ml'],
    ['Sitagliptin 50mg and Metformin 500mg Extended Release Tablets', 'tablet', 'metformin:500mg:MR|sitagliptin:50mg:MR'],
    ['Disodium Hydrogen Citrate Syrup (Alkalyser) 1.4 gm per 5 ml', 'syrup', 'disodium hydrogen citrate:1400mg/5ml'],
    ['Metoprolol Succinate 25mg (Extended Release) and Amlodipine Besilate 5mg Tablets IP', 'tablet', 'amlodipine:5mg|metoprolol:25mg:MR'],
  ])('%s', (name, form, want) => expect(read(name, form)).toBe(want));

  it('skips what it cannot read instead of guessing', () => {
    expect(read('Lactic Acid Bacillus Tablets 60 Million spores', 'tablet')).toMatch(/^skip/);
    expect(read('Vitamin B Complex and Ascorbic Acid Capsules', 'capsule')).toMatch(/^skip/);
  });
  it('keeps salts that are different products apart', () => {
    expect(canonicalMolecule('Diclofenac Potassium')).toBe('diclofenac potassium');
    expect(canonicalMolecule('Sitagliptin Phosphate')).toBe('sitagliptin');
    expect(canonicalMolecule('Ferrous Sulphate')).toBe('ferrous sulphate');
  });
});

describe('dataset brands', () => {
  const ja = new Map([
    ['cetirizine:5mg|paracetamol:325mg#tablet', 999],
    ['amoxicillin:500mg|clavulanic acid:125mg#tablet', 39],
    ['escitalopram:5mg#tablet', 1944],
    ['metformin:500mg:MR#tablet', 145],
    ['metformin:500mg#tablet', 144],
  ]);
  const row = (name, c1, c2 = '', label = 'strip of 10 tablets') => ({
    id: '1', name, 'price(₹)': '50', Is_discontinued: 'FALSE', manufacturer_name: 'X', type: 'allopathy', pack_size_label: label, short_composition1: c1, short_composition2: c2,
  });
  const run = (rows) => importKaggle(rows, { extra: new Map(), jaKeys: ja, curatedNames: new Set() }).kept.map((b) => b.brand);

  it('a two-ingredient row without both strengths in the name may be a 3-ingredient product: not kept', () => {
    // Cheston Cold is really cetirizine + paracetamol + phenylephrine; the dataset lists only two
    expect(run([row('Cheston Cold Tablet', 'Cetirizine (5mg)', 'Paracetamol (325mg)')])).toEqual([]);
  });
  it('a two-ingredient row with both strengths (or their sum) in the name is kept', () => {
    expect(run([row('Axylin CV 500mg/125mg Tablet', 'Amoxycillin  (500mg)', 'Clavulanic Acid (125mg)')])).toEqual(['Axylin CV 500mg/125mg']);
    expect(run([row('Augmentin 625 Duo Tablet', 'Amoxycillin  (500mg)', 'Clavulanic Acid (125mg)')])).toEqual(['Augmentin 625 Duo']);
  });
  it('release type comes from the label or name; plain and SR never mix', () => {
    expect(importKaggle([row('Glyco 500 Tablet SR', 'Metformin (500mg)', '', 'strip of 10 tablet sr')], { extra: new Map(), jaKeys: ja, curatedNames: new Set() }).kept[0].expected_ja_code).toBe(145);
    expect(importKaggle([row('Glyco 500 Tablet', 'Metformin (500mg)')], { extra: new Map(), jaKeys: ja, curatedNames: new Set() }).kept[0].expected_ja_code).toBe(144);
  });
  it('dispersible, mouth-dissolving and dry syrups are left out (different form)', () => {
    expect(run([row('Talo 5 Tablet DT', 'Escitalopram (5mg)', '', 'strip of 10 tablet dt')])).toEqual([]);
  });
  it('one name used for two different medicines: neither is kept', () => {
    expect(run([row('Same 500 Tablet', 'Metformin (500mg)'), row('Same 500 Tablet', 'Metformin (500mg)', '', 'strip of 10 tablet sr')])).toEqual([]);
  });
});
