/**
 * Unicode normalisation for anything sent to Zalo.
 *
 * Vietnamese stacks diacritics, and Unicode can spell them two ways: `ế` as one
 * codepoint (NFC) or as `e` plus two combining marks (NFD). They render
 * identically — nothing in the UI, the logs or a database dump tells them
 * apart — but the decomposed form is around 28% longer.
 *
 * This matters here more than in most apps. iOS normalises to NFD in several
 * paths, and the guest names and special requests in this system are typed on
 * phones. A name that passes a length check locally can arrive at Zalo over the
 * limit and come back as -1121, and because it depends on how one particular
 * guest's keyboard produced one particular character, it looks like a flaky API
 * rather than a bug.
 *
 * So: normalise at the boundary, then measure. Kept import-free so it stays
 * testable without a network or credentials.
 */

/** The form Zalo's limits are counted in. Apply before measuring or sending. */
export function toNfc(text: string): string {
  return text.normalize("NFC");
}

/** Length as Zalo will count it, not as the raw string happens to be encoded. */
export function zaloLength(text: string): number {
  return toNfc(text).length;
}

export function fitsZaloLimit(text: string, max: number): boolean {
  return zaloLength(text) <= max;
}

/**
 * Trim to a limit without splitting a character in half.
 *
 * Slicing decomposed text by index can cut between a letter and its diacritic,
 * leaving a stray combining mark that attaches itself to whatever follows.
 * Normalising first means one visible character is one unit to slice.
 */
export function truncateForZalo(text: string, max: number): string {
  const normalized = toNfc(text);
  if (normalized.length <= max) return normalized;
  // Array.from splits on codepoints rather than UTF-16 units, so an emoji in a
  // guest's name can't be halved into a lone surrogate either.
  return Array.from(normalized).slice(0, max).join("");
}
