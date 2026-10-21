// Spoken strengths → digits, for voice input. Pure text, no interpretation of the medicine.
/** "dolo six fifty" → "dolo 650"; spoken numbers are common for strengths. */
export function spokenToText(s: string): string {
  const ones: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  const teens: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  let out = s.toLowerCase().replace(/\bmilligrams?\b/g, 'mg');
  out = out.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+and)?(?:\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/g,
    (_, h, t2, o) => String(ones[h] * 100 + (t2 ? teens[t2] : 0) + (o ? ones[o] : 0)));
  out = out.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/g,
    (_, h, t2, o) => String(ones[h] * 100 + teens[t2] + (o ? ones[o] : 0))); // "six fifty" → 650
  out = out.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/g,
    (_, t2, o) => String(teens[t2] + (o ? ones[o] : 0)));
  out = out.replace(/\b(ten|eleven|twelve|fifteen)\b/g, (w) => String(teens[w]));
  out = out.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => String(ones[w]));
  return out;
}
