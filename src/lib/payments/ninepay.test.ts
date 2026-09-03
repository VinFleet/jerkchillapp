import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  canonicalizeParams,
  buildStringToSign,
  buildAuthorizationHeader,
  verifyIpn,
  toRequestId,
  isPaidStatus,
  isTerminalStatus,
  NINEPAY_STATUS,
} from "./ninepay.ts";

const KEY = "merchant-secret-key";
const CHECKSUM_KEY = "checksum-secret-key";

// ---------- canonicalization ----------

test("parameters are sorted by name and joined with &", () => {
  const s = canonicalizeParams({ request_id: "JCA1B2C4", amount: 210000, currency: "VND" });
  assert.equal(s, "amount=210000&currency=VND&request_id=JCA1B2C4");
});

test("empty, null and undefined parameters are dropped, not signed as text", () => {
  const s = canonicalizeParams({ a: "1", b: undefined, c: null, d: "" });
  assert.equal(s, "a=1", "an absent optional field must not become 'b=undefined'");
});

test("values are signed raw — encoding here but not on the wire is why signatures fail", () => {
  const s = canonicalizeParams({ description: "Thanh toán đơn hàng" });
  assert.equal(s, "description=Thanh toán đơn hàng");
});

// ---------- string to sign ----------

test("the string to sign is METHOD, URI, timestamp, params on four lines", () => {
  const s = buildStringToSign({
    method: "POST",
    uri: "/pos/merchant/create-transaction",
    timestamp: 1767225600,
    params: { amount: 210000, request_id: "JCA1B2C4" },
  });
  assert.equal(
    s,
    "POST\n/pos/merchant/create-transaction\n1767225600\namount=210000&request_id=JCA1B2C4"
  );
  assert.equal(s.split("\n").length, 4);
});

// ---------- authorization header ----------

test("the Authorization header carries HS256, the merchant key and a base64 signature", () => {
  const header = buildAuthorizationHeader({
    merchantKey: "NGuTdi",
    secretKey: KEY,
    method: "POST",
    uri: "/pos/merchant/create-transaction",
    timestamp: 1767225600,
    params: { amount: 210000 },
  });
  const expected = createHmac("sha256", KEY)
    .update("POST\n/pos/merchant/create-transaction\n1767225600\namount=210000", "utf8")
    .digest("base64");
  assert.equal(
    header,
    `Signature Algorithm=HS256,Credential=NGuTdi,SignedHeaders=,Signature=${expected}`
  );
  assert.ok(header.includes("SignedHeaders=,"), "the empty SignedHeaders key must survive");
});

test("a different secret produces a different signature", () => {
  const args = {
    merchantKey: "NGuTdi",
    method: "POST" as const,
    uri: "/x",
    timestamp: 1767225600,
    params: { a: 1 },
  };
  assert.notEqual(
    buildAuthorizationHeader({ ...args, secretKey: "one" }),
    buildAuthorizationHeader({ ...args, secretKey: "two" })
  );
});

// ---------- IPN ----------

function signIpn(payload: unknown, key = CHECKSUM_KEY) {
  const result = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const checksum = createHash("sha256").update(`${result}${key}`, "utf8").digest("hex").toUpperCase();
  return { result, checksum };
}

test("a genuine IPN verifies and decodes", () => {
  const payload = { request_id: "JCA1B2C4", payment_no: "9P123", amount: 210000, status: 5 };
  const { result, checksum } = signIpn(payload);
  const verdict = verifyIpn(CHECKSUM_KEY, result, checksum);
  assert.equal(verdict.ok, true);
  if (verdict.ok) assert.deepEqual(verdict.data, payload);
});

test("lowercase checksums from a provider still verify", () => {
  const { result, checksum } = signIpn({ request_id: "JCA1B2C4" });
  assert.equal(verifyIpn(CHECKSUM_KEY, result, checksum.toLowerCase()).ok, true);
});

test("a tampered amount is rejected — the checksum covers the whole result", () => {
  const { checksum } = signIpn({ request_id: "JCA1B2C4", amount: 10000 });
  const forged = Buffer.from(JSON.stringify({ request_id: "JCA1B2C4", amount: 9_000_000 }), "utf8").toString("base64");
  assert.deepEqual(verifyIpn(CHECKSUM_KEY, forged, checksum), { ok: false, reason: "bad_checksum" });
});

test("the wrong checksum key is rejected", () => {
  const { result, checksum } = signIpn({ request_id: "JCA1B2C4" }, "someone-elses-key");
  assert.deepEqual(verifyIpn(CHECKSUM_KEY, result, checksum), { ok: false, reason: "bad_checksum" });
});

test("everything fails closed", () => {
  const { result, checksum } = signIpn({ request_id: "JCA1B2C4" });
  assert.deepEqual(verifyIpn(undefined, result, checksum), { ok: false, reason: "not_configured" });
  assert.deepEqual(verifyIpn("short", result, checksum), { ok: false, reason: "not_configured" });
  assert.deepEqual(verifyIpn(CHECKSUM_KEY, null, checksum), { ok: false, reason: "incomplete" });
  assert.deepEqual(verifyIpn(CHECKSUM_KEY, result, null), { ok: false, reason: "incomplete" });
});

test("a valid checksum over non-JSON is malformed, not accepted", () => {
  const result = Buffer.from("not json at all", "utf8").toString("base64");
  const checksum = createHash("sha256").update(`${result}${CHECKSUM_KEY}`, "utf8").digest("hex").toUpperCase();
  assert.deepEqual(verifyIpn(CHECKSUM_KEY, result, checksum), { ok: false, reason: "malformed" });
});

test("a JSON array is malformed — the IPN is an object of fields", () => {
  const { result, checksum } = signIpn([1, 2, 3]);
  assert.deepEqual(verifyIpn(CHECKSUM_KEY, result, checksum), { ok: false, reason: "malformed" });
});

// ---------- status & reference ----------

test("only success and pending-settlement count as paid", () => {
  assert.equal(isPaidStatus(NINEPAY_STATUS.SUCCESS), true);
  assert.equal(isPaidStatus(NINEPAY_STATUS.PENDING_SETTLEMENT), true, "captured but not paid out is still paid at the table");
  for (const s of [NINEPAY_STATUS.PROCESSING, NINEPAY_STATUS.FAILED, NINEPAY_STATUS.CANCELLED, NINEPAY_STATUS.REFUNDED]) {
    assert.equal(isPaidStatus(s), false);
  }
});

test("only processing is non-terminal", () => {
  assert.equal(isTerminalStatus(NINEPAY_STATUS.PROCESSING), false);
  assert.equal(isTerminalStatus(NINEPAY_STATUS.FAILED), true);
  assert.equal(isTerminalStatus(NINEPAY_STATUS.REFUNDED), true);
});

test("our reference survives as a request_id; anything else is stripped", () => {
  assert.equal(toRequestId("JCA1B2C4"), "JCA1B2C4");
  assert.equal(toRequestId("JC-A1B2/C4 "), "JCA1B2C4", "9Pay accepts [a-zA-Z0-9] only");
  assert.equal(toRequestId("x".repeat(80)).length, 32);
});
