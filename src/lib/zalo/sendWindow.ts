/**
 * Zalo refuses every message between 22:00 and 06:00 Vietnam time.
 *
 * OA sends come back as -234, ZNS as -133, and both are permanent for that
 * attempt — a queue that ignores the window fills overnight with failures that
 * were never going to succeed. So the check happens before the call, not after
 * the rejection.
 *
 * This is also the reason Zalo can't carry the restaurant's own reminders: the
 * closing checklist, the last fridge check and the end-of-day sales entry all
 * happen after 22:00, squarely inside the ban. Guest booking confirmations sit
 * in daytime, which is why those are the ones worth sending.
 */

export const NIGHT_BAN_START_HOUR = 22;
export const NIGHT_BAN_END_HOUR = 6;

/** Zalo's guidance is 06:05, not 06:00 — see nextSendableTime. */
const RELEASE_OFFSET_MINUTES = 5;
const JITTER_WINDOW_MINUTES = 15;

/**
 * The hour of day in Vietnam, 0–23.
 *
 * Vietnam is UTC+7 year round with no daylight saving, but this reads the zone
 * properly rather than adding seven hours — the server's own clock is whatever
 * Vercel gives us, and a fixed offset would silently be wrong if that ever
 * moved.
 */
export function vietnamHour(at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hour12: false,
  }).format(at);
  // "24" appears for midnight in some ICU versions.
  return Number(hour) % 24;
}

/** True when Zalo will reject a send outright because of the hour. */
export function isInNightBan(at: Date = new Date()): boolean {
  const hour = vietnamHour(at);
  return hour >= NIGHT_BAN_START_HOUR || hour < NIGHT_BAN_END_HOUR;
}

/**
 * When to retry a send that the night ban blocked.
 *
 * Deliberately NOT 06:00. Everything deferred overnight would fire in the same
 * instant the window opens and trip the rate limit — turning one blocked send
 * into a burst of -32s. Zalo's own guidance is 06:05 with jitter, so this lands
 * in a spread across 06:05–06:20.
 *
 * Returns `at` itself when the window is already open, so callers can compare
 * without special-casing.
 */
export function nextSendableTime(at: Date = new Date(), jitter = Math.random()): Date {
  if (!isInNightBan(at)) return at;

  // Walk forward to the first hour that is outside the ban, then position
  // within it. Stepping by the hour keeps the arithmetic in the server's own
  // clock while the *decision* stays in Vietnam's.
  const cursor = new Date(at.getTime());
  for (let i = 0; i < 24; i += 1) {
    cursor.setTime(cursor.getTime() + 3600_000);
    if (!isInNightBan(cursor)) break;
  }

  // Trim to the top of that hour, then add the offset and jitter.
  const minute = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      minute: "2-digit",
    }).format(cursor)
  );
  const second = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      second: "2-digit",
    }).format(cursor)
  );
  cursor.setTime(cursor.getTime() - minute * 60_000 - second * 1000);

  const offsetMs = RELEASE_OFFSET_MINUTES * 60_000 + Math.floor(jitter * JITTER_WINDOW_MINUTES * 60_000);
  return new Date(cursor.getTime() + offsetMs);
}
