/**
 * Zalo's night restriction — which is per message type, not a blanket ban.
 *
 * This was previously implemented as "nothing sends between 22:00 and 06:00",
 * which is wrong and mattered: it would have deferred the staff group messages
 * that are the whole point of the integration, at exactly the hours the
 * restaurant needs them. Group chat and consultation replies send 24/24.
 *
 *   Consultation / CS     send 24/24   push 24/24        never blocked
 *   Group chat (GMF)      send 24/24   push 24/24        never blocked
 *   Transaction (Tag 1/2) send 24/24   push 06:00-21:59  arrives silently at night
 *   Promotional (Tag 3)   send 06:00-21:59                blocked with -234
 *   ZBS by phone          per-template flag               blocked with -133
 *
 * The timezone is an assumption — Zalo does not document it — and `-133` is
 * absent from the current ZBS error table and may be retired. Both are handled
 * defensively rather than relied upon.
 */

export const NIGHT_BAN_START_HOUR = 22;
export const NIGHT_BAN_END_HOUR = 6;

/** Zalo's guidance is 06:05, not 06:00 — see nextSendableTime. */
const RELEASE_OFFSET_MINUTES = 5;
const JITTER_WINDOW_MINUTES = 15;

export type ZaloMessageType =
  /** Reply to someone who messaged the OA. */
  | "cs"
  /** Into an OA-owned group. What this app uses for staff alerts. */
  | "group"
  /** ZBS Tag 1/2 — order updates, booking confirmations. */
  | "transaction"
  /** ZBS Tag 3 — marketing. */
  | "promotional"
  /** ZBS template addressed by phone number. */
  | "zbs_phone";

/**
 * The hour of day in Vietnam, 0–23.
 *
 * Reads the zone properly rather than adding seven hours: the server's clock is
 * whatever Vercel gives us, and a hardcoded offset would be silently wrong if
 * that ever moved.
 */
export function vietnamHour(at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hour12: false,
  }).format(at);
  return Number(hour) % 24;
}

/** Whether the clock is inside Zalo's restricted window at all. */
export function isNightHours(at: Date = new Date()): boolean {
  const hour = vietnamHour(at);
  return hour >= NIGHT_BAN_START_HOUR || hour < NIGHT_BAN_END_HOUR;
}

/**
 * Whether this particular message type would actually be refused right now.
 *
 * Deliberately narrow. Deferring a message Zalo would have accepted is not a
 * safe default here — it means the kitchen doesn't hear about the thing until
 * morning.
 */
export function isSendBlockedNow(type: ZaloMessageType, at: Date = new Date()): boolean {
  switch (type) {
    case "cs":
    case "group":
      // Explicitly permitted around the clock.
      return false;
    case "transaction":
      // Sends fine; only the push notification is suppressed at night, so the
      // guest sees it when they next open Zalo. Better than not sending.
      return false;
    case "promotional":
      return isNightHours(at);
    case "zbs_phone":
      // Governed by a per-template flag we cannot read from here. Attempt it,
      // and treat a -133 as the deferral signal.
      return false;
  }
}

/** True when the message will arrive but not buzz until morning. */
export function pushSuppressedNow(type: ZaloMessageType, at: Date = new Date()): boolean {
  return type === "transaction" && isNightHours(at);
}

/**
 * When to retry a send that was refused for the hour.
 *
 * Deliberately NOT 06:00. Everything deferred overnight would fire in the same
 * instant the window opens and trip the rate limit, turning one blocked send
 * into a burst of -32s. Zalo's guidance is 06:05, so this spreads across
 * 06:05–06:20.
 *
 * Returns `at` itself when nothing is blocked, so callers need no special case.
 */
export function nextSendableTime(at: Date = new Date(), jitter = Math.random()): Date {
  if (!isNightHours(at)) return at;

  const cursor = new Date(at.getTime());
  for (let i = 0; i < 24; i += 1) {
    cursor.setTime(cursor.getTime() + 3600_000);
    if (!isNightHours(cursor)) break;
  }

  const part = (unit: "minute" | "second") =>
    Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        [unit]: "2-digit",
      } as Intl.DateTimeFormatOptions).format(cursor)
    );
  cursor.setTime(cursor.getTime() - part("minute") * 60_000 - part("second") * 1000);

  const offsetMs =
    RELEASE_OFFSET_MINUTES * 60_000 + Math.floor(jitter * JITTER_WINDOW_MINUTES * 60_000);
  return new Date(cursor.getTime() + offsetMs);
}
