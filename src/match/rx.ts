// Whole-prescription input: split a typed/pasted (or Gemma-read printed) prescription into medicine lines.
// Dosage instructions are REMOVED before matching, never interpreted: "1-0-1 x 5 days after food" is the
// doctor's instruction, not part of the medicine's name, and the app never comments on it.

const DOSAGE_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\b/g, // 1-0-1, 1-1-1-1
  /\b(?:x|for)\s*\d+\s*(?:days?|d|weeks?|wks?|months?)\b/gi, // x 5 days, for 2 weeks
  /\b\d+\s*(?:days?|weeks?|wks?|months?)\b/gi, // 5 days
  /\b(?:od|bd|bid|tds|tid|qid|hs|sos|stat|prn|qd|qhs)\b/gi, // frequency abbreviations
  /\b(?:once|twice|thrice)\s+(?:a|daily|per)?\s*(?:day|daily)?\b/gi,
  /\b(?:after|before|with)\s+(?:food|meals?|breakfast|lunch|dinner)\b/gi,
  /\b(?:morning|night|bedtime|daily|empty stomach)\b/gi,
  /\b\d+\s*(?:tabs?|caps?|tablets?|capsules?)\s+(?:daily|a day)\b/gi,
];

/** "1. Tab. Dolo 650  1-0-1 x 5 days" → "Tab. Dolo 650" */
export function cleanRxLine(line: string): string {
  let s = line.replace(/^\s*(?:\d{1,2}\s*[.)]|[-•*●▪]|rx\b|℞)\s*/i, ''); // list numbering / bullets / Rx
  for (const p of DOSAGE_PATTERNS) s = s.replace(p, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** Lines, commas and semicolons separate medicines. "+" does not (it joins molecules in a combination). */
export function splitPrescription(text: string): string[] {
  return text
    .split(/[\n;,]+/)
    .map(cleanRxLine)
    .filter((l) => /[a-zऀ-ॿ]{3,}/i.test(l))
    .slice(0, 20);
}
