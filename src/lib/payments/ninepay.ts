import { createHmac, createHash, timingSafeEqual } from "node:crypto";

/**
 * 9Pay's two crypto schemes, kept pure and apart from any request.
 *
 * A card payment that settles on the terminal but never reaches the bill is
 * a guest charged twice, so both directions of this integration are exactly
 * the kind of decision CLAUDE.md says must be testable without a network:
 *
 *  - OUTBOUND: every API call carries an Authorization header whose
 *    signature is HMAC-SHA256 over METHOD, URI, timestamp and the request's
 *    parameters, base64-encoded.
 *  - INBOUND: the IPN carries `result` (base64 JSON) and a `checksum` that
 *    is a plain uppercase SHA-256 of result concatenated with a SEPARATE
 *    checksum key — not an HMAC, and not the signing secret. Their scheme,
 *    not ours; ours is to verify it in constant time and fail closed.
 *
 * ONE DOCUMENTED AMBIGUITY, deliberately not guessed away: 9Pay's rules page
 * says the canonicalized parameters are ordered alphabetically, but its own
 * worked example is in a different order (merchantKey, invoice_no, amount…).
 * `canonicalizeParams` implements the stated RULE and is a single seam, so
 * confirming the truth against sandbox is a one-line change here rather than
 * a hunt. Do not ship to production before that check — see docs/NINEPAY.md.
 */

export type NinePayMethod = "CARD" | "QR";

/**
 * 9Pay's transaction states. Only SUCCESS may settle a bill; PENDING_SETTLEMENT
 * means the money is captured but not yet paid out, which is still paid as far
 * as the guest and the table are concerned.
 */
export const NINEPAY_STATUS = {
  PROCESSING: 2,
  SUCCESS: 5,
  FAILED: 6,
  CANCELLED: 8,
  REFUNDED: 10,
  PENDING_SETTLEMENT: 17,
} as const;

export function isPaidStatus(status: number): boolean {
  return status === NINEPAY_STATUS.SUCCESS || status === NINEPAY_STATUS.PENDING_SETTLEMENT;
}

/** A settled state: nothing further will happen to this transaction. */
export function isTerminalStatus(status: number): boolean {
  return status !== NINEPAY_STATUS.PROCESSING;
}

/**
 * Parameters as one canonical string: `name=value` pairs joined with `&`.
 *
 * Sorted by name, per the stated rule. Values are used raw — the signature
 * is over what is sent, and encoding here while sending unencoded (or the
 * reverse) is the classic reason a correct-looking signature is rejected.
 * Undefined and null values are dropped rather than signed as "undefined".
 */
export function canonicalizeParams(params: Record<string, string | number | undefined | null>): string {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

/** METHOD \n URI \n timestamp \n canonicalized-params — the bytes that get signed. */
export function buildStringToSign(input: {
  method: "POST" | "GET";
  uri: string;
  timestamp: number;
  params: Record<string, string | number | undefined | null>;
}): string {
  return [
    input.method,
    input.uri,
    String(input.timestamp),
    canonicalizeParams(input.params),
  ].join("\n");
}

/**
 * The Authorization header value.
 *
 * SignedHeaders is deliberately empty — 9Pay's format keeps the key with an
 * empty value, and dropping the key entirely changes the header shape.
 */
export function buildAuthorizationHeader(input: {
  merchantKey: string;
  secretKey: string;
  method: "POST" | "GET";
  uri: string;
  timestamp: number;
  params: Record<string, string | number | undefined | null>;
}): string {
  const signature = createHmac("sha256", input.secretKey)
    .update(buildStringToSign(input), "utf8")
    .digest("base64");
  return `Signature Algorithm=HS256,Credential=${input.merchantKey},SignedHeaders=,Signature=${signature}`;
}

/** Constant-time compare that tolerates length differences without throwing. */
function equals(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}

export type IpnVerdict =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: "not_configured" | "incomplete" | "bad_checksum" | "malformed" };

/**
 * Whether an IPN is genuinely 9Pay's, and what it says.
 *
 * Fails closed on every path, and none of the failures explain themselves to
 * the caller — an endpoint that settles money must teach a prober nothing.
 * The checksum is uppercase hex SHA-256 of (result + checksumKey); comparison
 * is constant-time because an early-exit compare leaks the expected value one
 * character at a time to anyone willing to make enough requests.
 */
export function verifyIpn(
  checksumKey: string | undefined,
  result: string | null | undefined,
  providedChecksum: string | null | undefined
): IpnVerdict {
  if (!checksumKey || checksumKey.trim().length < 8) return { ok: false, reason: "not_configured" };
  if (!result || !providedChecksum) return { ok: false, reason: "incomplete" };

  const expected = createHash("sha256").update(`${result}${checksumKey}`, "utf8").digest("hex").toUpperCase();
  if (!equals(expected, providedChecksum.trim().toUpperCase())) {
    return { ok: false, reason: "bad_checksum" };
  }

  try {
    const decoded = JSON.parse(Buffer.from(result, "base64").toString("utf8")) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, data: decoded as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

/**
 * Our payment reference, as 9Pay's request_id.
 *
 * Their field accepts [a-zA-Z0-9] only, and ours is already "JC" + an
 * alphanumeric order code — so the reference the bill is waiting on travels
 * out and comes back untouched, and the till's existing pending-payment poll
 * settles the bill with no new client plumbing. Anything unexpected is
 * stripped rather than sent, because a rejected transaction at the terminal
 * happens with the guest's card already in hand.
 */
export function toRequestId(reference: string): string {
  return reference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}
