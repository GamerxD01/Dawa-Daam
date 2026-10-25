// Shared parsing for the big imports (PMBI product list and the Kaggle brand list).
// Both sides MUST go through the same functions, so "the same medicine" means the same thing on both.
// Every function returns null when unsure: a product we cannot read with confidence is left out.

/** Salt / ester words that do not change which medicine it is (strength is as labelled). */
const SALTS = new Set([
  'hydrochloride', 'hcl', 'dihydrochloride', 'hydrobromide', 'sodium', 'disodium', 'potassium', 'dipotassium',
  'calcium', 'magnesium', 'besilate', 'besylate', 'maleate', 'mesylate', 'mesilate', 'dimesylate', 'succinate',
  'tartrate', 'bitartrate', 'fumarate', 'citrate', 'phosphate', 'diphosphate', 'sulphate', 'sulfate', 'bisulphate',
  'bisulfate', 'acetate', 'dihydrate', 'monohydrate', 'trihydrate', 'hemihydrate', 'sesquihydrate', 'anhydrous',
  'medoxomil', 'cilexetil', 'bromide', 'valerate', 'ethanolate', 'hyclate', 'axetil', 'proxetil', 'oxalate',
  'malate', 'lactate', 'embonate', 'pamoate', 'napsylate', 'estolate', 'stearate', 'teoclate', 'xinafoate',
  'hydrogen', 'ip', 'bp', 'usp', 'hemifumarate', 'dihydrogen', 'erbumine', 'tosylate', 'nitrate', 'decanoate',
]);
/** Never strip down to a bare cation, and keep the salt where it really is a different product. */
const BARE = new Set(['disodium', 'dipotassium', 'sodium', 'potassium', 'calcium', 'magnesium', 'zinc', 'ferrous', 'ferric', 'iron', 'aluminium', 'lithium']);
const KEEP_SALT = new Set(['diclofenac']); // diclofenac sodium and diclofenac potassium are sold as different products

/** Spellings that differ between the two sources (and Indian vs international names). */
const SPELLINGS = {
  amoxycillin: 'amoxicillin', frusemide: 'furosemide', cetrizine: 'cetirizine', levocetrizine: 'levocetirizine',
  'levo thyroxine': 'levothyroxine', 'levo-thyroxine': 'levothyroxine', thyroxine: 'levothyroxine',
  'potassium clavulanate': 'clavulanic acid', 'clavulanate potassium': 'clavulanic acid', 'clavulanate': 'clavulanic acid',
  'diluted potassium clavulanate': 'clavulanic acid', salbutamol: 'salbutamol', albuterol: 'salbutamol',
  beclometasone: 'beclomethasone', 'vitamin d3': 'cholecalciferol', 'vit d3': 'cholecalciferol',
  'acetyl salicylic acid': 'aspirin', 'acetylsalicylic acid': 'aspirin', acenocoumarol: 'acenocoumarol',
  nicoumalone: 'acenocoumarol', 'paracetamol': 'paracetamol', acetaminophen: 'paracetamol',
  glibenclamide: 'glibenclamide', glyburide: 'glibenclamide', 'divalproex': 'divalproex', 'sodium valproate': 'valproic acid',
  valproate: 'valproic acid', 'valproic acid': 'valproic acid', rifampin: 'rifampicin', lignocaine: 'lidocaine',
  'ursodeoxycholic acid': 'ursodeoxycholic acid', ursodiol: 'ursodeoxycholic acid', 'metformin': 'metformin',
  chlorphenamine: 'chlorpheniramine', 'pheniramine': 'pheniramine', 'mecobalamin': 'methylcobalamin',
  'methyl cobalamin': 'methylcobalamin', 'esomeprazole': 'esomeprazole', 'serratiopeptidase': 'serratiopeptidase',
  serrapeptase: 'serratiopeptidase', 'ofloxacin': 'ofloxacin', 'cyclosporine': 'ciclosporin', cyclosporin: 'ciclosporin',
  'ciclosporin': 'ciclosporin', 'ethamsylate': 'etamsylate', 'etamsylate': 'etamsylate', 'trihexyphenidyl': 'trihexyphenidyl',
  'benzhexol': 'trihexyphenidyl', chlorthalidon: 'chlorthalidone', chlorthalidone: 'chlorthalidone', 'isosorbide-5-mononitrate': 'isosorbide mononitrate', 'isosorbide 5 mononitrate': 'isosorbide mononitrate',
};

/** Molecules whose oral tablets/capsules are always gastro-resistant, whether or not the label says so. */
const ALWAYS_GR = new Set(['pantoprazole', 'rabeprazole', 'omeprazole', 'esomeprazole', 'lansoprazole', 'dexrabeprazole', 'duloxetine']);

/** Canonical molecule key from a free-text ingredient name, or null. */
export function canonicalMolecule(raw, extra = new Map()) {
  let s = String(raw).toLowerCase().normalize('NFKC')
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || !/[a-z]{3}/.test(s)) return null;
  const look = (x) => extra.get(x) ?? SPELLINGS[x] ?? null;
  if (look(s)) return look(s);
  const words = s.split(' ');
  // strip trailing salt words ("sitagliptin phosphate" → "sitagliptin"), but never to a bare cation
  while (words.length > 1 && SALTS.has(words[words.length - 1]) && !KEEP_SALT.has(words.slice(0, -1).join(' '))) {
    const rest = words.slice(0, -1);
    // never strip down to a bare cation or to nothing but salt words ("disodium hydrogen citrate" stays as it is)
    if (rest.every((w) => BARE.has(w) || SALTS.has(w))) break;
    words.pop();
  }
  // leading salt words ("sodium valproate" is handled by the spelling list; "potassium losartan" is not a thing)
  s = words.join(' ');
  return look(s) ?? s;
}

/** "500mg" / "0.25 mcg" / "60000IU" / "125mg/5ml" / "10 mg per 5 ml" → strength, or null. */
export function parseStrength(raw) {
  const s = String(raw).toLowerCase().replace(/\s+/g, '').replace(/per/g, '/');
  const m = /^(\d+(?:\.\d+)?)(mg|mcg|µg|g|gm|iu|lakhiu)(?:\/(\d+(?:\.\d+)?)?ml)?$/.exec(s);
  if (!m) return null;
  let v = Number(m[1]);
  let u = m[2] === 'gm' ? 'g' : m[2] === 'µg' ? 'mcg' : m[2];
  if (u === 'lakhiu') { v *= 100000; u = 'iu'; }
  if (u === 'g') { v = round(v * 1000); u = 'mg'; } // 1 g and 1000 mg are the same strength
  if (!(v > 0)) return null;
  const per = m[3] !== undefined ? Number(m[3] || 1) : undefined;
  return { v, u, per };
}

const round = (n) => Math.round(n * 1000) / 1000;

/** Salts that only exist as modified-release products. */
const SALT_MR = /\bmetoprolol succinate\b/i;

export function component(name, strength, release, extra) {
  const m = canonicalMolecule(name, extra);
  const st = parseStrength(strength);
  if (!m || !st) return null;
  return { m, v: st.v, u: st.u, per: st.per, r: SALT_MR.test(name) && release === 'IR' ? 'MR' : release };
}

/** Apply the always-gastro-resistant rule to oral solids. Same rule on both sides. */
export function settle(comp, form) {
  if (form === 'tablet' || form === 'capsule') for (const c of comp) if (ALWAYS_GR.has(c.m) && c.r === 'IR') c.r = 'GR';
  return comp.sort((a, b) => a.m.localeCompare(b.m));
}

export const compText = (comp) =>
  comp.map((c) => `${c.m}:${c.v}${c.u}${c.per ? '/' + c.per + 'ml' : ''}${c.r === 'IR' ? '' : ':' + c.r}`).join('|');

export const compKey = (comp, form) => `${compText(comp)}#${form}`;

const MR_RE = /\b(prolonged|extended|sustained|modified|controlled)[\s-]*release\b|\b(sr|er|xr|cr|pr|mr|xl)\b/i;
const GR_RE = /\bgastro[\s-]*resistant\b|\benteric[\s-]*coated\b|\bdelayed[\s-]*release\b|\b(ec|dr)\b/i;
export const releaseOf = (text) => (GR_RE.test(text) ? 'GR' : MR_RE.test(text) ? 'MR' : null);
export { MR_RE, GR_RE };
