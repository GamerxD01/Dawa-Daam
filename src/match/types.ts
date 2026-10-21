/** One active ingredient in a product, e.g. metformin 500 mg modified-release. */
export interface Component {
  /** canonical molecule name, lower case */
  m: string;
  /** strength value */
  v: number;
  /** strength unit: mg | mcg | g | iu */
  u: string;
  /** for liquids: strength is per this many ml */
  per?: number;
  /** release family: IR (immediate), MR (SR/ER/PR/XL/CR), GR (gastro-resistant / enteric-coated) */
  r: 'IR' | 'MR' | 'GR';
}

export type Form = 'tablet' | 'capsule' | 'suspension' | 'syrup' | 'inhaler' | 'sachet';

export interface Generic {
  code: number;
  name: string;
  comp: Component[];
  form: Form;
  pack: number;
  mrp: number;
}

export interface Brand {
  id: string;
  name: string;
  aliases: string[];
  maker: string;
  comp: Component[];
  form: Form;
  pack: number;
  mrp: number;
  expectedJa: number | null;
  source: string;
  captured: string;
  verified: boolean;
  note: string;
}

export interface Molecule {
  name: string;
  synonyms: string[];
  hi: string;
}

export interface DrugData {
  version: string;
  molecules: Molecule[];
  generics: Generic[];
  brands: Brand[];
  comboAliases: { molecules: string[]; aliases: string[] }[];
}

/** Jan Aushadhi products that are exactly equivalent (same composition + form), cheapest first. */
export interface GenericGroup {
  key: string;
  comp: Component[];
  form: Form;
  items: Generic[];
}

export type Hit =
  | { type: 'brand'; brand: Brand; group: GenericGroup | null; otherForm?: GenericGroup | null; score: number }
  | { type: 'generic'; group: GenericGroup; brands: Brand[]; score: number };

export type SearchResult =
  | { kind: 'empty' }
  /** confident single answer */
  | { kind: 'match'; hit: Hit }
  /** several plausible answers — never silently pick */
  | { kind: 'didyoumean'; hits: Hit[] }
  /** same medicine, several strengths in data, query gave none */
  | { kind: 'strength'; hits: Hit[] }
  /** nothing we can stand behind */
  | { kind: 'none'; reason: 'unknown' | 'strength-unavailable'; name?: string; requested?: number[]; near: Hit[] };
