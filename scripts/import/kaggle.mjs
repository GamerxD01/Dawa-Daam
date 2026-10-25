// Brands from the public "A-Z Medicine Dataset of India" (Kaggle). Prices are older and were not checked by us,
// so every row is marked unverified and the app labels it as an indicative price from a public dataset.
// A brand is kept only if it is EXACTLY the same as a Jan Aushadhi product (same molecules, strengths,
// release type and form). Anything we cannot read with confidence is left out.
import { component, compKey, compText, settle, releaseOf } from './composition.mjs';

/** The dataset never says which diclofenac salt; sodium and potassium are different products. */
const AMBIGUOUS = new Set(['diclofenac']);
/** Modified-release markers in a combination name: which ingredient they belong to. */
const MR_OWNER = ['metformin', 'domperidone'];

const LABEL = /^(strip|bottle|box|packet|blister) of (\d+(?:\.\d+)?)\s*(ml\s+)?(.*)$/i;

function formOf(label, name) {
  const l = label.toLowerCase(), n = ` ${name.toLowerCase()} `;
  const bad = /\b(dt|md|odt|chewable|effervescent|dispersible|mouth dissolving|orally disintegrating|sublingual|dry syrup|drops?|granules|sachet|powder|kid|kids|junior|chewing|lozenge|gum|jelly|film|strips?|vaginal|soap|injection)\b/;
  if (bad.test(l.replace(/^strip of\b/, '')) || bad.test(n)) return null;
  const m = LABEL.exec(l);
  if (!m) return null;
  const qty = Number(m[2]), rest = m[4];
  if (m[3]) {
    if (/^oral suspension$|^suspension$/.test(rest.trim())) return { form: 'suspension', qty };
    if (/^syrup$/.test(rest.trim())) return { form: 'syrup', qty };
    return null;
  }
  if (/^(tablets?|tablet (sr|er|pr|xr|cr|xl|mr|ec|dr))$/.test(rest.trim())) return { form: 'tablet', qty, rel: rest.split(' ')[1] };
  if (/^((soft|hard) gelatin )?(capsules?|capsule (sr|er|pr|xr|cr|mr|dr|ec))$/.test(rest.trim())) return { form: 'capsule', qty, rel: rest.split(' ').pop() };
  return null;
}

/** "Amoxycillin  (500mg)" → component */
function parseIngredient(s, extra) {
  const m = /^\s*(.+?)\s*\(\s*([^)]+?)\s*\)\s*$/.exec(s ?? '');
  if (!m) return null;
  return component(m[1], m[2], 'IR', extra) && { name: m[1], strength: m[2], c: component(m[1], m[2], 'IR', extra) };
}

/** Strength-like numbers printed in the brand name ("500mg/125mg" → [500, 125], "60K" → [60000]). */
function nameNumbers(name) {
  const n = name.toLowerCase().replace(/(\d)\s*k\b/g, (_, d) => `${d}000`).replace(/(\d+(?:\.\d+)?)\s*gm?\b/g, (_, v) => `${Number(v) * 1000}`);
  return [...n.matchAll(/(?<![a-z])(\d+(?:\.\d+)?)(?![\d.])/g)].map((m) => Number(m[1]));
}

/** Short display name: "Pan 40 Tablet" → "Pan 40", "Glycomet 500 Tablet SR" → "Glycomet 500 SR". */
export function displayName(name) {
  return name.replace(/\b(film[\s-]coated\s+)?(tablets?|capsules?|oral suspension|suspension|syrup|soft gelatin|hard gelatin)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Name key that ignores units and punctuation: "Pan 40mg", "PAN-40" and "Pan 40" are the same name. */
export const nameKey = (s) => s.toLowerCase().replace(/(\d)\s*(mg|mcg|gm|g|ml|iu)\b/g, '$1').replace(/[^a-z0-9]+/g, ' ').trim();
const norm = nameKey;

export function importKaggle(rows, { extra, jaKeys, curatedNames }) {
  const kept = new Map(), skipped = {}, clash = new Set();
  const skip = (why) => (skipped[why] = (skipped[why] ?? 0) + 1);
  for (const r of rows) {
    if (r.Is_discontinued === 'TRUE') { skip('discontinued'); continue; }
    const price = Number(r['price(₹)']);
    if (!(price > 0)) { skip('no price'); continue; }
    const f = formOf(r.pack_size_label, r.name);
    if (!f || !(f.qty > 0)) { skip('not a plain tablet / capsule / syrup / suspension'); continue; }
    const parts = [r.short_composition1, r.short_composition2].filter((x) => x && x.trim());
    const ing = parts.map((p) => parseIngredient(p, extra));
    if (!ing.length || ing.some((x) => !x)) { skip('composition not readable'); continue; }
    const comp = ing.map((x) => x.c);
    if (comp.some((c) => AMBIGUOUS.has(c.m))) { skip('salt not stated (diclofenac)'); continue; }
    if (new Set(comp.map((c) => c.m)).size !== comp.length) { skip('same molecule twice'); continue; }
    // liquids: the strength must be per N ml; solids: it must not be
    const liquid = f.form === 'syrup' || f.form === 'suspension';
    if (comp.some((c) => liquid !== Boolean(c.per))) { skip('strength unit does not fit the form'); continue; }

    // The dataset keeps at most two ingredients. A two-ingredient row is trusted only if the brand name itself
    // prints both strengths ("500mg/125mg") or their sum ("625"); otherwise it may be a 3-ingredient product.
    const nums = nameNumbers(r.name);
    const vals = comp.map((c) => c.v);
    if (comp.length === 2) {
      const both = nums.length === 2 && vals.every((v) => nums.includes(v));
      const sum = nums.length === 1 && nums[0] === vals[0] + vals[1];
      if (!both && !sum) { skip('two ingredients, strengths not in the name (could be a 3-ingredient product)'); continue; }
    } else if (nums.length > 1 || (nums.length === 1 && nums[0] !== vals[0] && !/\d\s*k\b/i.test(r.name))) {
      skip('numbers in the name do not match the strength'); continue;
    }

    // release type: from the pack label ("tablet sr") or the name ("Tablet ER", "DSR", "XL")
    const n = ` ${r.name} `;
    if (/\bod\b/i.test(n)) { skip('"OD" in the name: release type unclear'); continue; }
    const relTxt = [f.rel ?? '', /\bdsr\b/i.test(n) ? 'SR' : '', n].join(' ');
    const rel = releaseOf(relTxt);
    if (rel) {
      if (comp.length === 1) comp[0].r = rel;
      else if (/\bdsr\b/i.test(n)) { const d = comp.find((c) => c.m === 'domperidone'); if (!d) { skip('release type unclear'); continue; } d.r = 'MR'; }
      else {
        // the whole product is modified-release: same rule as the PMBI side (every ingredient MR)
        for (const c of comp) c.r = rel;
      }
    }
    settle(comp, f.form);
    const key = compKey(comp, f.form);
    const ja = jaKeys.get(key);
    if (!ja) { skip('no exact Jan Aushadhi equivalent'); continue; }

    const name = displayName(r.name);
    const id = norm(name);
    if (curatedNames.has(id)) { skip('already in our checked list'); continue; }
    const row = {
      brand: name, aliases: '', manufacturer: r.manufacturer_name, composition: compText(comp), form: f.form,
      pack_qty: f.qty, mrp_inr: price.toFixed(2), expected_ja_code: ja, source_url: `dataset:kaggle-az-medicine#${r.id}`,
      captured_on: '', verified: 'n', note: 'dataset',
    };
    // same brand name in several packs: keep the one with the lowest price per unit (never overstates the saving)
    const prev = kept.get(id);
    if (prev && (prev.composition !== row.composition || prev.form !== row.form)) { clash.add(id); continue; }
    if (!prev || price / f.qty < Number(prev.mrp_inr) / prev.pack_qty) kept.set(id, row);
    else skip('duplicate pack');
  }
  // one name, two different medicines: we cannot tell which one the patient has, so neither is kept
  for (const id of clash) { kept.delete(id); skip('same name used for different medicines'); }
  return { kept: [...kept.values()], skipped };
}
