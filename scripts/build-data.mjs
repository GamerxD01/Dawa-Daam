#!/usr/bin/env node
// Builds src/generated/drugs.json from the hand-curated CSVs in data/src.
// Fails loudly on bad rows: an unknown molecule, a missing price or a malformed
// composition is a data bug, and data bugs here can mislead a patient.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'data', 'src', f);

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas in fields). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r, i) => {
    if (r.length !== head.length) throw new Error(`row ${i + 2}: expected ${head.length} fields, got ${r.length}`);
    return Object.fromEntries(head.map((h, j) => [h.trim(), r[j].trim()]));
  });
}

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const split = (s) => (s ? s.split('|').map((x) => x.trim().toLowerCase()).filter(Boolean) : []);

// ---- molecules -------------------------------------------------------------
const molecules = parseCsv(readFileSync(src('molecules.csv'), 'utf8')).map((r) => ({
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
    const sm = /^(\d+(?:\.\d+)?)(mg|mcg|g|iu)(?:\/(\d+(?:\.\d+)?)ml)?$/i.exec(strength || '');
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
const generics = parseCsv(readFileSync(src('janaushadhi.csv'), 'utf8')).map((r, i) => {
  const where = `janaushadhi.csv row ${i + 2} (code ${r.ja_code})`;
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
const brands = parseCsv(readFileSync(src('brands.csv'), 'utf8')).map((r, i) => {
  const where = `brands.csv row ${i + 2} (${r.brand})`;
  if (!FORMS.has(r.form)) fail(where, `unknown form "${r.form}"`);
  if (!/^https?:\/\//.test(r.source_url)) fail(where, 'every brand price needs a source_url');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.captured_on)) fail(where, 'captured_on must be YYYY-MM-DD');
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
