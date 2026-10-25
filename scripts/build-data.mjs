#!/usr/bin/env node
// Builds src/generated/drugs.json from the hand-curated CSVs in data/src.
// Fails loudly on bad rows: an unknown molecule, a missing price or a malformed
// composition is a data bug, and data bugs here can mislead a patient.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib-csv.mjs';
export { parseCsv };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'data', 'src', f);
const auto = (f) => join(root, 'data', 'auto', f);
const readOpt = (p) => (existsSync(p) ? parseCsv(readFileSync(p, 'utf8')) : []);

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const split = (s) => (s ? s.split('|').map((x) => x.trim().toLowerCase()).filter(Boolean) : []);

// ---- molecules -------------------------------------------------------------
const molecules = [...parseCsv(readFileSync(src('molecules.csv'), 'utf8')), ...readOpt(auto('molecules_auto.csv'))].map((r) => ({
  name: r.canonical.toLowerCase(),
  synonyms: split(r.synonyms),
  hi: r.hindi || '',
}));
const canon = new Map();
for (const m of molecules) {
  for (const n of [m.name, ...m.synonyms]) {
    if (canon.has(n) && canon.get(n) !== m.name) fail('molecules.csv', `"${n}" maps to two molecules`);
    canon.set(n, m.name);
  }
}

// ---- composition: "metformin:500mg:MR|glimepiride:1mg" ---------------------
const RELEASES = new Set(['IR', 'MR', 'GR']);
function parseComposition(s, where) {
  return s.split('|').map((part) => {
    const [mRaw, strength, rel = 'IR'] = part.split(':').map((x) => x.trim());
    const m = canon.get((mRaw || '').toLowerCase());
    if (!m) fail(where, `unknown molecule "${mRaw}" (add it to molecules.csv)`);
    const sm = /^(\d+(?:\.\d+)?)(mg|mcg|g|iu|mspores)(?:\/(\d+(?:\.\d+)?)ml)?$/i.exec(strength || '');
    if (!sm) fail(where, `bad strength "${strength}" for ${mRaw}`);
    if (!RELEASES.has(rel)) fail(where, `bad release "${rel}" (use IR, MR or GR)`);
    return {
      m: m || mRaw,
      v: sm ? Number(sm[1]) : 0,
      u: sm ? sm[2].toLowerCase() : '',
      per: sm && sm[3] ? Number(sm[3]) : undefined,
      r: rel,
    };
  }).sort((a, b) => a.m.localeCompare(b.m));
}

const FORMS = new Set(['tablet', 'capsule', 'suspension', 'syrup', 'inhaler', 'sachet']);
const num = (s, where, field) => {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) fail(where, `${field} must be a positive number, got "${s}"`);
  return n;
};

// ---- Jan Aushadhi generics -------------------------------------------------
const seenCodes = new Set();
const curatedJa = parseCsv(readFileSync(src('janaushadhi.csv'), 'utf8')).map((r) => ({ ...r, file: 'janaushadhi.csv' }));
const autoJa = readOpt(auto('janaushadhi_pmbi.csv')).map((r) => ({ ...r, file: 'auto/janaushadhi_pmbi.csv' }));
const generics = [...curatedJa, ...autoJa].map((r, i) => {
  const where = `${r.file} (code ${r.ja_code})`;
  const code = Number(r.ja_code);
  if (seenCodes.has(code)) fail(where, 'duplicate ja_code');
  seenCodes.add(code);
  if (!FORMS.has(r.form)) fail(where, `unknown form "${r.form}"`);
  return {
    code,
    name: r.name,
    comp: parseComposition(r.composition, where),
    form: r.form,
    pack: num(r.pack_qty, where, 'pack_qty'),
    mrp: num(r.mrp_inr, where, 'mrp_inr'),
  };
});

// ---- curated brands --------------------------------------------------------
function readBrand(r, where, dataset) {
  if (!FORMS.has(r.form)) fail(where, `unknown form "${r.form}"`);
  if (dataset ? !r.source_url.startsWith('dataset:') : !/^(https?:\/\/|strip:)/.test(r.source_url)) fail(where, 'every brand price needs a source_url (a URL, or strip:<what is printed>)');
  if (!dataset && !/^\d{4}-\d{2}-\d{2}$/.test(r.captured_on)) fail(where, 'captured_on must be YYYY-MM-DD');
  if (!['y', 'n'].includes(r.verified)) fail(where, 'verified must be y or n');
  return {
    id: r.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: r.brand,
    aliases: split(r.aliases),
    maker: r.manufacturer,
    comp: parseComposition(r.composition, where),
    form: r.form,
    pack: num(r.pack_qty, where, 'pack_qty'),
    mrp: num(r.mrp_inr, where, 'mrp_inr'),
    expectedJa: r.expected_ja_code ? Number(r.expected_ja_code) : null,
    source: r.source_url,
    captured: r.captured_on,
    verified: r.verified === 'y',
    note: r.note || '',
  };
}
const brands = parseCsv(readFileSync(src('brands.csv'), 'utf8')).map((r, i) => readBrand(r, `brands.csv row ${i + 2} (${r.brand})`, false));

// Brands from the public dataset: every one must be EXACTLY its expected Jan Aushadhi product, or the build fails.
const byCode = new Map(generics.map((g) => [g.code, g]));
const compKey = (comp, form) => comp.map((c) => `${c.m}:${c.v}${c.u}${c.per ? '/' + c.per : ''}:${c.r}`).join('+') + '#' + form;
const datasetBrands = readOpt(auto('brands_dataset.csv')).map((r, i) => {
  const b = readBrand(r, `auto/brands_dataset.csv row ${i + 2} (${r.brand})`, true);
  const g = byCode.get(b.expectedJa);
  if (!g || compKey(g.comp, g.form) !== compKey(b.comp, b.form)) fail(`auto/brands_dataset.csv row ${i + 2} (${r.brand})`, `not the same composition as Jan Aushadhi ${b.expectedJa}`);
  return b;
});

// ---- combination nicknames (e.g. "amoxyclav") ------------------------------
const comboAliases = parseCsv(readFileSync(src('combo_aliases.csv'), 'utf8')).map((r, i) => {
  const ms = split(r.molecules).map((m) => {
    const c = canon.get(m);
    if (!c) fail(`combo_aliases.csv row ${i + 2}`, `unknown molecule "${m}"`);
    return c || m;
  }).sort();
  return { molecules: ms, aliases: split(r.aliases) };
});

if (errors.length) {
  console.error(`✗ data build failed with ${errors.length} error(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}

const out = {
  version: new Date().toISOString().slice(0, 10),
  molecules,
  generics,
  brands,
  comboAliases,
};
const dest = join(root, 'src', 'generated', 'drugs.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
console.log(`✓ drugs.json: ${generics.length} Jan Aushadhi generics, ${brands.length} brands, ${molecules.length} molecules`);

// Compact, separately loaded file for the dataset brands: [name, maker, ja_code, pack, mrp, dataset id].
// The composition is not repeated: it is, by construction, the Jan Aushadhi product's composition.
const makers = [...new Set(datasetBrands.map((b) => b.maker))].sort();
const makerIx = new Map(makers.map((m, i) => [m, i]));
const extraOut = {
  version: out.version,
  source: 'Adapted from the A-Z Medicine Dataset of India by Shudhanshu Singh (Kaggle), CC BY-SA 4.0; prices not checked by us',
  license: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
  makers,
  rows: datasetBrands.map((b) => [b.name, makerIx.get(b.maker), b.expectedJa, b.pack, b.mrp, b.source.split('#')[1]]),
};
const extraDest = join(root, 'public', 'data', 'brands.json');
mkdirSync(dirname(extraDest), { recursive: true });
writeFileSync(extraDest, JSON.stringify(extraOut));
console.log(`✓ public/data/brands.json: ${datasetBrands.length} dataset brands`);

// ---- official Kendra list (offline search by PIN / district) ------------------
const kendras = readOpt(auto('kendras.csv'));
for (const [i, k] of kendras.entries()) {
  if (!/^PMBJK\d+$/.test(k.code) || !/^\d{6}$/.test(k.pin) || !k.district || !k.state) fail(`auto/kendras.csv row ${i + 2}`, `bad Kendra row ${JSON.stringify(k)}`);
}
if (errors.length) {
  console.error(`✗ data build failed with ${errors.length} error(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
const states = [...new Set(kendras.map((k) => k.state))].sort();
const districts = [...new Set(kendras.map((k) => k.district))].sort();
const kOut = {
  version: out.version,
  source: 'Jan Aushadhi Kendra list, janaushadhi.gov.in (Locate PMBJK Kendra), 25 Oct 2026',
  states,
  districts,
  rows: kendras.map((k) => [k.code, states.indexOf(k.state), districts.indexOf(k.district), k.pin, k.address]),
};
writeFileSync(join(root, 'public', 'data', 'kendras.json'), JSON.stringify(kOut));
console.log(`✓ public/data/kendras.json: ${kendras.length} Kendras in ${states.length} state(s), ${districts.length} districts`);
