#!/usr/bin/env node
// Official Jan Aushadhi Kendra list (janaushadhi.gov.in → Locate PMBJK Kendra → export PDF), converted with
//   pdftotext -layout kendra.pdf data/raw/kendras-<state>-<date>.txt
// into data/auto/kendras.csv. We keep the Kendra code, state, district, PIN code and address.
// The operator's personal name is NOT kept: the app doesn't need it.
//   node scripts/import/kendras.mjs data/raw/kendras-*.txt
import { readFileSync, writeFileSync } from 'node:fs';

const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
const ROW = new RegExp(`^\\s*(\\d+)\\s+(PMBJK\\d+)\\s+(.*?)\\s*\\b(${STATES.join('|')})\\s+([A-Z][A-Za-z .()-]+?)\\s{2,}(\\d{6})\\s*(.*)$`, 'i');
/** District names that are always cut in the PDF. */
const DISTRICT_FIX = { 'Sant Kabir': 'Sant Kabir Nagar', 'Gautam': 'Gautam Buddha Nagar', 'Ambedkar': 'Ambedkar Nagar' };
const HEADER = /^\s*(List of Kendra|Sr\.?\s*No|Code\s+Name)/;

export function parseKendraText(text) {
  const out = [];
  let cur = null, addrCol = 0;
  const finish = () => {
    if (!cur) return;
    let address = cur.address.join(' ').replace(/\\$/, '').replace(/\s+/g, ' ').trim();
    // some rows repeat the operator's name in the address column: that is not an address
    if (!address || address.toLowerCase() === cur.nameFirst.toLowerCase()) address = '';
    out.push({ code: cur.code, state: cur.state, district: cur.district.join(' ').replace(/\s+/g, ' ').trim(), pin: cur.pin, address });
    cur = null;
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || HEADER.test(line)) continue;
    const m = ROW.exec(line);
    if (m) {
      finish();
      cur = { code: m[2], nameFirst: m[3].trim(), state: STATES.find((x) => x.toLowerCase() === m[4].toLowerCase()), district: [m[5].trim()], pin: m[6], address: m[7] ? [m[7]] : [] };
      addrCol = m[7] ? line.lastIndexOf(m[7]) : line.indexOf(m[6]) + 9;
      continue;
    }
    if (!cur) continue;
    if (line.length > addrCol - 2 && line.slice(addrCol - 2).trim()) cur.address.push(line.slice(addrCol - 2).trim());
  }
  finish();
  // A long district name that wrapped in the PDF comes out cut ("Gautam", "Sant Kabir"): snap it to the full name
  // used by the other rows of the same state (the most common name that starts the same way).
  const count = new Map();
  for (const r of out) count.set(`${r.state}|${r.district}`, (count.get(`${r.state}|${r.district}`) ?? 0) + 1);
  for (const r of out) {
    let best = r.district, n = count.get(`${r.state}|${r.district}`);
    for (const [k, c] of count) {
      const [st, d] = k.split('|');
      if (st === r.state && d !== r.district && (d.startsWith(r.district + ' ') || r.district.startsWith(d + ' ')) && c > n) { best = d; n = c; }
    }
    r.district = DISTRICT_FIX[best] ?? best;
  }
  return out;
}

if (process.argv[1]?.endsWith('kendras.mjs')) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('usage: node scripts/import/kendras.mjs data/raw/kendras-*.txt');
  const rows = files.flatMap((f) => parseKendraText(readFileSync(f, 'utf8')));
  const seen = new Set(), uniq = rows.filter((r) => !seen.has(r.code) && seen.add(r.code));
  const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync('data/auto/kendras.csv', ['code,state,district,pin,address', ...uniq.map((r) => [r.code, r.state, r.district, r.pin, r.address].map(cell).join(','))].join('\n') + '\n');
  console.log(`✓ data/auto/kendras.csv: ${uniq.length} Kendras (${uniq.filter((r) => !r.address).length} without an address)`);
}
