/**
 * Tests for payment webhook authentication.
 *
 * This is the check between the open internet and "mark that bill paid", so
 * the cases below are the ways someone gets in for free.
 *
 * Run: npm run test:webhook
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyWebhook } from "./webhookAuth.ts";

const SECRET = "a-real-secret-of-sufficient-length";
const BODY = '{"id":"abc123","transferAmount":170000,"content":"JCA1B2C41"}';
const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex");

test("a genuine callback is accepted", () => {
  assert.deepEqual(verifyWebhook(SECRET, BODY, sign(BODY)), { ok: true });
});

test("providers vary in how they present the signature", () => {
  // Casing and a "sha256=" prefix are both seen in the wild; neither is a
  // forgery and rejecting them would break a real integration.
  assert.equal(verifyWebhook(SECRET, BODY, sign(BODY).toUpperCase()).ok, true);
  assert.equal(verifyWebhook(SECRET, BODY, `sha256=${sign(BODY)}`).ok, true);
  assert.equal(verifyWebhook(SECRET, BODY, `  ${sign(BODY)}  `).ok, true);
});

// ---------- the ways in ----------

test("no secret configured rejects everything", () => {
  // The dangerous default. An unset secret must not mean "allow all" — that
  // would make a fresh deploy settle bills for anyone who found the URL.
  assert.deepEqual(verifyWebhook(undefined, BODY, sign(BODY)), {
    ok: false,
    reason: "not_configured",
  });
  assert.equal(verifyWebhook("", BODY, sign(BODY)).ok, false);
  // Too short to be meaningful — a placeholder someone typed to get going.
  assert.equal(verifyWebhook("secret", BODY, sign(BODY)).ok, false);
});

test("a missing signature is rejected", () => {
  assert.deepEqual(verifyWebhook(SECRET, BODY, null), {
    ok: false,
    reason: "missing_signature",
  });
});

test("a signature made with the wrong secret is rejected", () => {
  assert.equal(verifyWebhook(SECRET, BODY, sign(BODY, "the-wrong-secret-entirely")).ok, false);
});

test("a tampered body is rejected", () => {
  // The attack this exists to stop: replay a real callback with the amount
  // raised, or the reference switched to another table's bill.
  const tampered = BODY.replace("170000", "10000");
  assert.equal(verifyWebhook(SECRET, tampered, sign(BODY)).ok, false);

  const switched = BODY.replace("JCA1B2C41", "JCZ9Y8X71");
  assert.equal(verifyWebhook(SECRET, switched, sign(BODY)).ok, false);
});

test("nonsense in the signature header does not throw", () => {
  // A crash here is a 500, and some providers treat 5xx as retryable forever.
  for (const junk of ["", "   ", "not-hex", "sha256=", "%%%", "0".repeat(500)]) {
    assert.doesNotThrow(() => verifyWebhook(SECRET, BODY, junk));
    assert.equal(verifyWebhook(SECRET, BODY, junk).ok, false);
  }
});

test("a signature of a different length is rejected without throwing", () => {
  // timingSafeEqual throws on length mismatch; that must be handled, and the
  // handling must not itself become a timing signal.
  assert.doesNotThrow(() => verifyWebhook(SECRET, BODY, "abc"));
  assert.equal(verifyWebhook(SECRET, BODY, "abc").ok, false);
});

test("an empty body still verifies against its own signature", () => {
  // Not a valid payment, but the auth layer should not be the thing that
  // decides that — it either matches or it does not.
  assert.equal(verifyWebhook(SECRET, "", sign("")).ok, true);
});
