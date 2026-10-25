// Minimal CSV reader shared by the data scripts.
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
