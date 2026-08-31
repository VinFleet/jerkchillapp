import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Whether a payment webhook is genuinely from our provider.
 *
 * This is the only thing standing between the internet and "mark that bill
 * paid". Everything here fails closed: an unset secret, a missing signature,
 * a malformed one and a wrong one are all rejected, and none of them explain
 * which — an attacker probing the endpoint learns nothing from the response.
 *
 * The comparison is constant-time. A byte-by-byte compare that returns early
 * leaks the correct signature a character at a time to anyone willing to make
 * enough requests, which for an endpoint that settles money is not a
 * theoretical concern.
 *
 * Kept import-free of Supabase and Next so it can be tested directly.
 */

export type WebhookVerdict =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "missing_signature" | "bad_signature" };

/** Constant-time compare that tolerates different lengths without throwing. */
function equals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal. Compare hashes of equal length instead.
  const ah = createHmac("sha256", "len").update(ab).digest();
  const bh = createHmac("sha256", "len").update(bb).digest();
  return timingSafeEqual(ah, bh);
}

/**
 * @param secret   the shared secret, from PAYMENT_WEBHOOK_SECRET
 * @param rawBody  the request body exactly as received — re-serialising JSON
 *                 changes key order and whitespace, and the signature is over
 *                 the bytes the provider sent, not over an equivalent object
 * @param provided the signature from the provider's header
 */
export function verifyWebhook(
  secret: string | undefined,
  rawBody: string,
  provided: string | null
): WebhookVerdict {
  // No secret means we cannot tell a real callback from a forged one. Accepting
  // would be worse than rejecting every payment: the failure mode of rejecting
  // is a waiter confirming by hand, and of accepting is a stranger closing bills.
  if (!secret || secret.trim().length < 16) return { ok: false, reason: "not_configured" };
  if (!provided) return { ok: false, reason: "missing_signature" };

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Providers differ on casing and on prefixing with "sha256=".
  const normalised = provided.trim().replace(/^sha256=/i, "").toLowerCase();

  return equals(expected, normalised) ? { ok: true } : { ok: false, reason: "bad_signature" };
}
