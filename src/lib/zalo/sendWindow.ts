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
 * The next moment a send would be accepted.
 *
 * Returns `at` itself when the window is already open, so callers can compare
 * without special-casing.
 */
export function nextSendableTime(at: Date = new Date()): Date {
  if (!isInNightBan(at)) return at;

  // Step forward hour by hour rather than doing date arithmetic in a zone that
  // isn't the server's — one of these hours is 06:00 in Vietnam, whatever the
  // host's clock says.
  const next = new Date(at.getTime());
  for (let i = 0; i < 24; i += 1) {
    next.setTime(next.getTime() + 3600_000);
    if (!isInNightBan(next)) {
      // Land on the top of the hour so queued sends don't cluster on a minute
      // determined by whenever the booking happened to be made.
      const minute = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          minute: "2-digit",
        }).format(next)
      );
      next.setTime(next.getTime() - minute * 60_000);
      return next;
    }
  }
  return next;
}
