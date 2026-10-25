import type { Brand, DrugData } from './types';

/** public/data/brands.json: brands from a public dataset, each an exact equivalent of a Jan Aushadhi product. */
export interface DatasetFile {
  version: string;
  source: string;
  makers: string[];
  /** [name, maker index, Jan Aushadhi code, pack, MRP, dataset row id] */
  rows: [string, number, number, number, number, string][];
}

/** Turn the compact rows into Brand objects. The composition is the Jan Aushadhi product's, by construction. */
export function hydrateDataset(core: DrugData, file: DatasetFile): Brand[] {
  const byCode = new Map(core.generics.map((g) => [g.code, g]));
  const out: Brand[] = [];
  for (const [name, maker, code, pack, mrp, id] of file.rows) {
    const g = byCode.get(code);
    if (!g) continue; // data files out of step: skip rather than guess
    out.push({
      id: `ds-${id}`, name, aliases: [], maker: file.makers[maker] ?? '', comp: g.comp, form: g.form, pack, mrp,
      expectedJa: code, source: `dataset:kaggle-az-medicine#${id}`, captured: '', verified: false, note: 'dataset',
    });
  }
  return out;
}

export const isDataset = (b: Brand) => b.source.startsWith('dataset:');
