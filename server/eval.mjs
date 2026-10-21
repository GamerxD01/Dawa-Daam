#!/usr/bin/env node
// Measures how well Gemma reads real strip photos. Honest numbers for docs/GEMMA.md.
//
//   node server/eval.mjs <folder-with-photos> [expected.csv]
//
// expected.csv (optional): file,brand,strength   e.g.  1.jpg,Dolo 650,650
// For each photo: time taken, lines read, and whether the brand name and strength appear in what Gemma read.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { readStrip } from './gemma-bridge.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node server/eval.mjs <photo-folder> [expected.csv]');
  process.exit(1);
}
const expPath = process.argv[3] ?? join(dir, 'expected.csv');
const expected = new Map();
if (existsSync(expPath)) {
  for (const line of readFileSync(expPath, 'utf8').split(/\r?\n/).slice(1)) {
    const [file, brand, strength] = line.split(',').map((s) => s?.trim());
    if (file) expected.set(file, { brand, strength });
  }
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const photos = readdirSync(dir).filter((f) => ['.jpg', '.jpeg', '.png'].includes(extname(f).toLowerCase())).sort();
const rows = [];
for (const f of photos) {
  const img = readFileSync(join(dir, f)).toString('base64');
  const t0 = Date.now();
  let lines = [];
  let error = '';
  try {
    lines = await readStrip(img);
  } catch (e) {
    error = String(e.message ?? e);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const all = norm(lines.join(' '));
  const exp = expected.get(f);
  const brandOk = exp?.brand ? all.includes(norm(exp.brand.replace(/\d+/g, ''))) : null;
  const strengthOk = exp?.strength ? all.includes(norm(exp.strength)) : null;
  rows.push({ f, secs, lines, brandOk, strengthOk, error });
  console.log(`${f}  ${secs}s  brand:${fmt(brandOk)} strength:${fmt(strengthOk)}  ${error || lines.slice(0, 4).join(' | ')}`);
}

const scored = rows.filter((r) => r.brandOk !== null);
console.log('\n| Photo | Seconds | Brand read | Strength read | First lines |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.f} | ${r.secs} | ${fmt(r.brandOk)} | ${fmt(r.strengthOk)} | ${(r.error || r.lines.slice(0, 3).join(' / ')).replace(/\|/g, '/')} |`);
if (scored.length) {
  const b = scored.filter((r) => r.brandOk).length, s = scored.filter((r) => r.strengthOk).length;
  console.log(`\nBrand read correctly: ${b}/${scored.length} · Strength read correctly: ${s}/${scored.length}`);
}

function fmt(v) {
  return v === null ? '–' : v ? '✓' : '✗';
}
