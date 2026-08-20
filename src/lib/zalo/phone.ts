/**
 * Vietnamese phone numbers, in the one shape Zalo accepts.
 *
 * Zalo documents `84987654321` and `+84987654321` only. The domestic
 * `0987654321` form that everyone actually types is *not* documented as
 * accepted and comes back as error -108, so it is normalised here rather than
 * discovered at send time.
 */

/** Digits only, country code, no leading zero — e.g. "84987654321". */
export function normalizeVnPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let national: string;
  if (digits.startsWith("84")) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  // A leading zero can survive the country code when someone writes the number
  // as "+84 0987…", which is wrong but common.
  national = national.replace(/^0+/, "");

  // Vietnamese mobile numbers are 9 digits after the leading 0 (03/05/07/08/09
  // prefixes since the 2018 renumbering). Landlines are 9 too, with a 2x area
  // code. Anything outside that isn't reachable on Zalo.
  if (national.length !== 9) return null;

  return `84${national}`;
}

export function isValidVnPhone(raw: string): boolean {
  return normalizeVnPhone(raw) !== null;
}

/** How the number should be shown back to staff — "0987 654 321". */
export function formatVnPhoneForDisplay(raw: string): string {
  const normalized = normalizeVnPhone(raw);
  if (!normalized) return raw;
  const n = normalized.slice(2);
  return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
