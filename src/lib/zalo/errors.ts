import { ZALO_ERROR_CLASS, ZALO_OVERLOADED_CODES, type ZaloRetryClass } from "./errorTable.ts";

/**
 * Zalo's errors, sorted into what you actually do about them.
 *
 * The classification is generated from `zalo-errors.json`, never transcribed by
 * hand — an earlier hand-written table filed -211 and -1441 as "transient" when
 * both are quota conditions that will not clear by retrying today, so the retry
 * loop would have burned attempts against a wall until the daily reset.
 *
 * Two things make this layer necessary rather than incidental:
 *
 * 1. Every Zalo API returns HTTP 200 even when it failed. The failure is a
 *    non-zero `error` inside the body. Code that trusts the status code sees
 *    success forever — the single most common silent failure in these
 *    integrations.
 * 2. There are ~146 codes across four surfaces. Branching on them individually
 *    spreads Zalo's quirks through the whole codebase.
 */

export type { ZaloRetryClass };

export function classifyZaloError(code: number): ZaloRetryClass {
  const known = ZALO_ERROR_CLASS.get(code);
  if (known) return known;
  // An unknown code retries rather than dead-letters: a pointless retry costs
  // one call, whereas dead-lettering a recoverable error loses the message.
  return "transient";
}

/** True when this code means more than one thing and the message must be read. */
export function isOverloadedCode(code: number): boolean {
  return ZALO_OVERLOADED_CODES.has(code);
}

/** Codes that mean specifically "not now, because of the hour". */
export function isNightBanCode(code: number): boolean {
  return code === -133 || code === -234;
}

/**
 * The GMF asset behind a staff group has expired.
 *
 * Worth its own check because Zalo presents a *billing* condition as a
 * *message* error — the group hasn't been disabled by anyone, the package
 * lapsed and the group is on its way to being deleted. Reading this as a
 * transient send failure would mean nobody finds out until the group vanishes.
 */
export function isGroupExpiredCode(code: number): boolean {
  return code === -237;
}

export class ZaloError extends Error {
  readonly code: number;
  readonly kind: ZaloRetryClass;
  readonly payload: unknown;
  readonly zaloMessage: string;

  constructor(code: number, message: string, payload?: unknown) {
    super(`Zalo ${code}: ${message}`);
    this.name = "ZaloError";
    this.code = code;
    this.kind = classifyZaloError(code);
    this.zaloMessage = message;
    this.payload = payload;
  }

  get isNightBan(): boolean {
    return isNightBanCode(this.code);
  }

  get isGroupExpired(): boolean {
    return isGroupExpiredCode(this.code);
  }

  /** Whether a human must act, as opposed to a queue retrying or rescheduling. */
  get needsAttention(): boolean {
    return this.kind === "needs_human";
  }

  /** Whether retrying the identical payload could ever succeed. */
  get retryable(): boolean {
    return this.kind === "transient" || this.kind === "auth_refresh";
  }

  /** Whether this should be tried again later today, or only after a reset. */
  get reschedulable(): boolean {
    return this.kind === "quota" || this.kind === "night_ban";
  }
}

/**
 * Unwraps Zalo's universal `{ data, error, message }` envelope.
 *
 * Every response goes through here — that is the point. `error: 0` is the only
 * success value, and it arrives with HTTP 200 exactly like a failure does.
 */
export function unwrapZaloResponse<T>(body: unknown): T {
  const envelope = body as { data?: T; error?: number; message?: string } | null;
  if (!envelope || typeof envelope !== "object") {
    throw new ZaloError(-1, "Zalo returned a body that wasn't an object", body);
  }
  const code = envelope.error ?? -1;
  if (code !== 0) {
    throw new ZaloError(code, envelope.message ?? "Unknown Zalo error", body);
  }
  return envelope.data as T;
}
