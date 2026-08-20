/**
 * Zalo's errors, sorted into what you actually do about them.
 *
 * Two things make this necessary rather than incidental:
 *
 * 1. Every Zalo API returns HTTP 200 even when it failed. The failure is a
 *    non-zero `error` inside the body. Code that trusts the status code sees
 *    success forever — this is the single most common way these integrations
 *    fail silently.
 * 2. There are ~90 error codes. Branching on them individually spreads Zalo's
 *    quirks through the whole codebase, so they collapse into four buckets and
 *    the caller switches on the bucket.
 */

export type ZaloErrorClass =
  /** Token is stale. Refresh once and retry the same call. */
  | "auth_refresh"
  /** Config or consent is wrong. A person has to fix it; retrying never will. */
  | "auth_human"
  /** Worth trying again later — rate limits, the night ban, transient faults. */
  | "transient"
  /** This exact payload will never succeed. Log it, don't retry it. */
  | "permanent";

const AUTH_REFRESH = new Set([-216, -220, -124, 452]);
const AUTH_HUMAN = new Set([-101, -102, -103, -104, -105, -219, -135, -1351, 112, -320, -321, -136, -137, -1381]);
const TRANSIENT = new Set([-32, -100, -144, -133, -234, -211, -1441]);
const PERMANENT = new Set([-201, -108, -1121, -1122, -230, -131, -114, -119, -117, -118, -139, -140, -141, -1124]);

export function classifyZaloError(code: number): ZaloErrorClass {
  if (AUTH_REFRESH.has(code)) return "auth_refresh";
  if (AUTH_HUMAN.has(code)) return "auth_human";
  if (TRANSIENT.has(code)) return "transient";
  if (PERMANENT.has(code)) return "permanent";
  // An unknown code is treated as transient rather than permanent: a retry
  // that turns out to be pointless costs one call, whereas dead-lettering a
  // recoverable error loses a guest's confirmation for good.
  return "transient";
}

/** Codes that mean specifically "not now, because of the hour". */
export function isNightBanCode(code: number): boolean {
  return code === -133 || code === -234;
}

export class ZaloError extends Error {
  readonly code: number;
  readonly kind: ZaloErrorClass;
  readonly payload: unknown;

  constructor(code: number, message: string, payload?: unknown) {
    super(`Zalo ${code}: ${message}`);
    this.name = "ZaloError";
    this.code = code;
    this.kind = classifyZaloError(code);
    this.payload = payload;
  }

  get isNightBan(): boolean {
    return isNightBanCode(this.code);
  }

  /** Whether a human needs to be told, as opposed to a queue retrying. */
  get needsAttention(): boolean {
    return this.kind === "auth_human";
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
