// Parse the official PMBI product list into structured compositions.
// Only oral tablets, capsules, syrups and suspensions that we can read with confidence are kept;
// every product we skip is listed with the reason in data/auto/pmbi-skipped.csv.
import { component, compText, releaseOf, settle, MR_RE, GR_RE } from './composition.mjs';

const SKIP_GROUPS = new Set(['Surgical & Medical Consumables', 'Ayurvedic', 'Nutraceuticals', 'Derma Care']);
const NOT_ORAL = /\b(injection|infusion|vial|ampoule|cream|gel|ointment|lotion|drops?|spray|shampoo|soap|suppositor|pessar|patch|respules?|rotacaps?|inhaler|inhalation|mdi|nebul|eye|ear|nasal|mouth ?wash|tooth|vaginal|rectal|enema|lozenges?|dusting|topical|external|transdermal|kit|combi ?pack|combo|pack of|solution|powder|granules|sachet|dispersible|mouth dissolving|orally disintegrating|chewable|effervescent|sublingual|dry syrup|for oral suspension|elixir|emulsion|paste|jelly|liniment|bandage|plaster|w\/w|w\/v|v\/v|%)\b/i;

/** Typos and spacing seen in the PMBI list, fixed before anything else. */
export function tidyName(name) {
  return ` ${name} `
    .replace(/\b(tabelts|tabets|tablest|tabltes)\b/gi, 'Tablets').replace(/\b(capsuels|capules|capsuls|capulses)\b/gi, 'Capsules').replace(/\btab\s*$/i, 'Tablets')
    .replace(/\bmagnessium\b/gi, 'Magnesium').replace(/\benyme\b/gi, 'Enzyme')
    .replace(/([a-z])(\d+(?:\.\d+)?\s*(?:mg|mcg|iu)\b)/gi, '$1 $2') // "Methylcobalamin1500mcg"
    .replace(/[.;]+\s*$/, '').replace(/\s+/g, ' ').trim();
}

const DESCRIPTORS = /\b(paediatric|pediatric|micronised|micronized|purified|sterile|plain|digestive enzyme|enzyme)\b/gi;

function formOf(name) {
  const n = name.toLowerCase();
  if (/\boral suspension\b|\bsuspension\b/.test(n)) return 'suspension';
  if (/\bsyrup\b/.test(n)) return 'syrup';
  if (/\bcapsules?\b/.test(n)) return 'capsule';
  if (/\btablets?\b/.test(n)) return 'tablet';
  return null;
}

/** "10's" / "15's Bottle" / "100 ml" / "60ml in Mono-carton" → { qty, unit } */
function packOf(unit, form) {
  const u = unit.toLowerCase();
  if (form === 'tablet' || form === 'capsule') {
    const m = /^(\d+)\s*'?s\b/.exec(u) ?? /^(\d+)\s*(tablets?|capsules?|nos?)\b/.exec(u);
    return m ? Number(m[1]) : null;
  }
  const m = /^(\d+(?:\.\d+)?)\s*ml\b/.exec(u);
  return m ? Number(m[1]) : null;
}

const STRENGTH = String.raw`(\d+(?:\.\d+)?)\s*(mg|mcg|gm|g|iu)\b`;

/**
 * "Aceclofenac 100mg and Paracetamol 325mg Tablets" → two components.
 * "Prednisolone Tablets IP 10 mg" → one. "Pantoprazole 20mg (Gastro-resistant) and Domperidone 10mg (Prolonged Release) Capsules IP".
 * Returns { comp } or { reason }.
 */
export function parseGenericName(name, form, extra) {
  let s = ` ${tidyName(name)} `.replace(DESCRIPTORS, ' ').replace(/\s+/g, ' ')
    // "25mg Chlordiazepoxide 10mg" → "25mg and Chlordiazepoxide 10mg" (but not before the form words)
    .replace(/(\d\s*(?:mg|mcg|iu))\s+(?!(?:tablets?|capsules?|syrup|oral|suspension|ip|bp|usp|film|soft|hard|per|and)\b)(?=[a-z]{3})/gi, '$1 and ');
  // "Lopinavir and Ritonavir Tablets IP (200mg + 50mg)": names first, strengths in brackets after
  const split = /^\s*([a-z][a-z\s-]+?)\s+and\s+([a-z][a-z\s-]+?)\s+(tablets?|capsules?)(?:\s+ip)?\s*\(\s*([\d.]+\s*(?:mg|mcg))\s*\+\s*([\d.]+\s*(?:mg|mcg))\s*\)\s*$/i.exec(s);
  if (split) s = ` ${split[1]} ${split[4]} and ${split[2]} ${split[5]} ${split[3]} `;
  // "Amlodipine + Enalapril Tablet (5/5 Mg)", "Olmesartan + Amlodipine + Chlorthalidone Tablet (40/5/12.5 Mg)"
  const slash = /^\s*([a-z][a-z\s+-]+?)\s+(tablets?|capsules?)\s*\(\s*([\d.\s/]+?)\s*(mg|mcg)\s*\)\s*$/i.exec(s);
  if (slash) {
    const names = slash[1].split(/\s*\+\s*/), vals = slash[3].split('/').map((x) => x.trim());
    if (names.length < 2 || names.length !== vals.length) return { reason: 'names and strengths do not line up' };
    s = ` ${names.map((n, i) => `${n} ${vals[i]}${slash[4]}`).join(' and ')} ${slash[2]} `;
  }
  s = resolveBrackets(s);
  if (s === null) return { reason: 'brackets with a different strength' };
  // drop the dosage-form words and pharmacopoeia marks; remember a form-level release marker
  const formPhrase = /\b((?:film[\s-]coated|uncoated|soft gelatin|hard gelatin|coated|oral)\s+)*(tablets?|capsules?|oral suspension|suspension|syrup)\b/gi;
  const formLevel = [];
  s = s.replace(/\b((?:prolonged|extended|sustained|modified|controlled|delayed)[\s-]*release|gastro[\s-]*resistant|enteric[\s-]*coated)\s+(?=(?:film[\s-]coated\s+)?(tablets?|capsules?))/gi, (m) => { formLevel.push(m); return ' '; });
  s = s.replace(formPhrase, ' ').replace(/\b(ip|bp|usp|i\.p\.)\b/gi, ' ');
  s = s.replace(/\bper\s*(\d*(?:\.\d+)?)\s*ml\b/gi, (_, n) => `/${n || 1}ml`).replace(/\s+/g, ' ').trim();
  const perAll = /\/(\d+(?:\.\d+)?)ml\b/.exec(s);
  if ((form === 'syrup' || form === 'suspension') && !perAll) return { reason: 'liquid without "per N ml"' };
  s = s.replace(/\s*\/\d+(?:\.\d+)?ml\b/g, '');

  const parts = s.split(/\s*(?:,|\band\b|&|\+|\bwith\b)\s*/i).filter((p) => p.trim());
  const comp = [];
  for (const part of parts) {
    let p = part.trim();
    let rel = releaseOf(p);
    p = p.replace(/\(([^)]*)\)/g, (m, inner) => (MR_RE.test(inner) || GR_RE.test(inner) ? ' ' : m))
      .replace(new RegExp(MR_RE.source, 'gi'), ' ').replace(new RegExp(GR_RE.source, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    // "Name 10mg" or "Name (Synonym) 10 mg"
    const m = new RegExp(`^(.+?)\\s+${STRENGTH}$`, 'i').exec(p);
    if (!m) return { reason: `cannot read "${part.trim()}"` };
    if (/\d/.test(m[1].replace(/\([^)]*\)/g, '')) && !/^(vitamin|vit)\b/i.test(m[1])) return { reason: `number inside name "${m[1]}"` };
    const c = component(m[1], `${m[2]}${m[3]}${perAll ? '/' + perAll[1] + 'ml' : ''}`, rel ?? 'IR', extra);
    if (!c) return { reason: `cannot read "${part.trim()}"` };
    comp.push(c);
  }
  if (!comp.length) return { reason: 'no ingredients' };
  if (formLevel.length) {
    const rel = releaseOf(formLevel.join(' '));
    // "Sitagliptin 50mg and Metformin 500mg Extended Release Tablets": the whole tablet is extended-release, so every
    // ingredient is marked MR. The brand side uses the same rule, so like is compared with like.
    if (!comp.some((c) => c.r !== 'IR')) for (const c of comp) c.r = rel;
  }
  if (new Set(comp.map((c) => c.m)).size !== comp.length) return { reason: 'same molecule twice' };
  return { comp: settle(comp, form) };
}

const HAS_STRENGTH = new RegExp(STRENGTH, 'i');
const ONLY_STRENGTH = new RegExp(`^\\s*${STRENGTH}(?:\\s*(?:/|per)\\s*\\d*(?:\\.\\d+)?\\s*ml)?\\s*$`, 'i');

/**
 * Brackets: "(30mg/5ml)" is unwrapped; "(Benzhexol ... 2mg)" with the same strength as outside is an alias and dropped;
 * "(Suger free)", "(Nitroglycerin ...)" carry no strength and are dropped; a bracket that holds the only strengths
 * ("Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets") replaces the name outside it.
 * Release markers inside brackets are kept for the per-ingredient pass. Returns null when brackets disagree with the name.
 */
function resolveBrackets(text) {
  let s = text.replace(/\(\s*\)/g, ' ');
  // stray unbalanced brackets ("40mg Sustained Release)")
  if ((s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length) s = s.replace(/[()]/g, ' ');
  const nums = (t) => [...t.matchAll(new RegExp(STRENGTH, 'gi'))].map((m) => Number(m[1])).sort((a, b) => a - b).join(',');
  const outside = s.replace(/\([^()]*\)/g, ' ');
  let bad = false;
  s = s.replace(/\(([^()]*)\)/g, (m, inner) => {
    if (MR_RE.test(inner) || GR_RE.test(inner)) return m.match(/\d/) ? m : m; // per-ingredient release, handled later
    if (ONLY_STRENGTH.test(inner)) return ` ${inner} `;
    if (!HAS_STRENGTH.test(inner)) return ' ';
    if (HAS_STRENGTH.test(outside)) { if (nums(inner) !== nums(outside)) bad = true; return ' '; }
    return ` ${inner} `; // the bracket holds the ingredients; the word before it is a group name
  });
  if (bad) return null;
  // "Co-trimoxazole Sulphamethoxazole 800mg ..." → drop a group word that sat in front of the bracket
  if (!HAS_STRENGTH.test(outside) && /\(/.test(text)) s = s.replace(/^\s*[a-z-]+(?:\s+[a-z-]+)?\s+(?=[a-z]+\s+[a-z\s]*\d)/i, (w) => (/co-trimoxazole|mpff|micronized|micronised/i.test(w) ? ' ' : w));
  return ` ${s} `.replace(/\s+/g, ' ');
}

export function importPmbi(rows, extra) {
  const kept = [], skipped = [];
  for (const r of rows) {
    const code = Number(r['Drug Code']);
    const name = tidyName(r['Generic Name']);
    const mrp = Number(r.MRP);
    const skip = (reason) => skipped.push({ code, name, reason });
    if (!(mrp > 0)) { skip('no MRP in the list'); continue; }
    if (SKIP_GROUPS.has(r['Group Name'])) { skip(`group: ${r['Group Name']}`); continue; }
    if (NOT_ORAL.test(name) || NOT_ORAL.test(r['Unit Size'])) { skip('not an oral tablet / capsule / syrup / suspension we compare'); continue; }
    const form = formOf(name);
    if (!form) { skip('form not stated'); continue; }
    const pack = packOf(r['Unit Size'], form);
    if (!pack) { skip(`pack size "${r['Unit Size']}" not readable`); continue; }
    const res = parseGenericName(name, form, extra);
    if (!res.comp) { skip(res.reason); continue; }
    kept.push({ ja_code: code, name, composition: compText(res.comp), form, pack_qty: pack, mrp_inr: mrp.toFixed(2), comp: res.comp });
  }
  return { kept, skipped };
}
