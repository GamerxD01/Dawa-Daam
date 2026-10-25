#!/usr/bin/env node
// Rebuild the large, machine-read data from the raw source files:
//   data/raw/pmbi-product-list-*.csv   official PMBI product list (Jan Aushadhi)
//   data/raw/kaggle-az-medicines.csv   public brand list (not committed: large, third-party; see docs/DATA.md)
// Writes data/auto/*.csv, which data:build validates like everything else. Hand-checked rows in data/src always win.
//   node scripts/import-big.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib-csv.mjs';
import { compKey } from './import/composition.mjs';
import { importPmbi, tidyName } from './import/pmbi.mjs';
import { importKaggle, nameKey } from './import/kaggle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (f) => join(root, 'data', 'raw', f);
const read = (p) => parseCsv(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const writeCsv = (p, cols, rows) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
};

// ---- curated data: molecule synonyms and hand-checked products ------------------------
const curatedMol = read(join(root, 'data/src/molecules.csv'));
const extra = new Map();
for (const m of curatedMol) for (const n of [m.canonical, ...m.synonyms.split('|')].filter(Boolean)) extra.set(n.toLowerCase(), m.canonical.toLowerCase());

const curatedJaPath = join(root, 'data/src/janaushadhi.csv');
const curatedJa = read(curatedJaPath);
const curatedCodes = new Set(curatedJa.map((r) => Number(r.ja_code)));

// ---- PMBI ----------------------------------------------------------------------------
const pmbiFile = readdirSync(join(root, 'data/raw')).filter((f) => /^pmbi-product-list-.*\.csv$/.test(f)).sort().pop();
if (!pmbiFile) throw new Error('data/raw/pmbi-product-list-YYYY-MM-DD.csv not found');
const pmbiRows = read(raw(pmbiFile));
const listDate = /(\d{4}-\d{2}-\d{2})/.exec(pmbiFile)[1];
const { kept: jaAuto, skipped: jaSkipped } = importPmbi(pmbiRows, extra);

// Hand-checked rows keep their composition; their MRP is refreshed from the newer official list.
const official = new Map(pmbiRows.map((r) => [Number(r['Drug Code']), r]));
const autoByCode = new Map(jaAuto.map((r) => [r.ja_code, r]));
let refreshed = 0;
for (const r of curatedJa) {
  const o = official.get(Number(r.ja_code));
  const parsed = autoByCode.get(Number(r.ja_code));
  if (!o || !(Number(o.MRP) > 0)) continue;
  // only refresh when the pack is unchanged (or we read the same pack), so the price is for the same quantity
  if (parsed && parsed.pack_qty !== Number(r.pack_qty)) continue;
  if (!parsed && !new RegExp(`^${r.pack_qty}\\b`).test(o['Unit Size'])) continue;
  if (Number(r.mrp_inr).toFixed(2) !== Number(o.MRP).toFixed(2)) { r.mrp_inr = Number(o.MRP).toFixed(2); refreshed++; }
}
writeCsv(curatedJaPath, ['ja_code', 'name', 'composition', 'form', 'pack_qty', 'mrp_inr'], curatedJa);

const jaNew = jaAuto.filter((r) => !curatedCodes.has(r.ja_code));
writeCsv(join(root, 'data/auto/janaushadhi_pmbi.csv'), ['ja_code', 'name', 'composition', 'form', 'pack_qty', 'mrp_inr'], jaNew);
writeCsv(join(root, 'data/auto/pmbi_skipped.csv'), ['code', 'name', 'reason'], jaSkipped);

// every Jan Aushadhi product by exact composition key (curated + auto), for brand matching
const normCurated = (c) => c.split('|').map((p) => {
  const [m, s, r] = p.split(':');
  const st = s.replace(/^(\d+(?:\.\d+)?)g$/, (_, v) => `${Number(v) * 1000}mg`);
  return { m: extra.get(m) ?? m, s: st, r: r && r !== 'IR' ? r : '' };
}).sort((a, b) => a.m.localeCompare(b.m)).map((x) => `${x.m}:${x.s}${x.r ? ':' + x.r : ''}`).join('|');
const jaKeys = new Map();
for (const r of curatedJa) jaKeys.set(`${normCurated(r.composition)}#${r.form}`, Number(r.ja_code));
for (const r of jaNew) if (!jaKeys.has(compKey(r.comp, r.form))) jaKeys.set(compKey(r.comp, r.form), r.ja_code);

// molecules seen in the new products that the curated list does not know yet
const known = new Set(curatedMol.map((m) => m.canonical.toLowerCase()));
const autoMol = new Set();
for (const r of jaNew) for (const c of r.comp) if (!known.has(c.m)) autoMol.add(c.m);

// ---- brands ----------------------------------------------------------------------------
const kagglePath = raw('kaggle-az-medicines.csv');
let brands = [], brandSkipped = {};
if (existsSync(kagglePath)) {
  const curatedBrands = read(join(root, 'data/src/brands.csv'));
  const norm = nameKey;
  const curatedNames = new Set(curatedBrands.flatMap((b) => [b.brand, ...b.aliases.split('|')].filter(Boolean).map(norm)));
  ({ kept: brands, skipped: brandSkipped } = importKaggle(read(kagglePath), { extra, jaKeys, curatedNames }));
  for (const b of brands) for (const p of b.composition.split('|')) { const m = p.split(':')[0]; if (!known.has(m)) autoMol.add(m); }
  writeCsv(join(root, 'data/auto/brands_dataset.csv'),
    ['brand', 'aliases', 'manufacturer', 'composition', 'form', 'pack_qty', 'mrp_inr', 'expected_ja_code', 'source_url', 'captured_on', 'verified', 'note'],
    brands.sort((a, b) => a.brand.localeCompare(b.brand)));
} else console.log('(no data/raw/kaggle-az-medicines.csv: brand import skipped, existing data/auto/brands_dataset.csv kept)');

writeCsv(join(root, 'data/auto/molecules_auto.csv'), ['canonical', 'synonyms', 'hindi'],
  [...autoMol].sort().map((m) => ({ canonical: m, synonyms: '', hindi: '' })));

console.log(`PMBI list ${listDate}: ${pmbiRows.length} products → ${jaAuto.length} oral products read (${jaNew.length} new, ${refreshed} hand-checked prices refreshed), ${jaSkipped.length} skipped`);
if (existsSync(kagglePath)) {
  console.log(`Brands: ${brands.length} kept with an exact Jan Aushadhi equivalent`);
  console.log(Object.entries(brandSkipped).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  skipped ${v}: ${k}`).join('\n'));
}
console.log(`Molecules added: ${autoMol.size}`);
export { tidyName };
