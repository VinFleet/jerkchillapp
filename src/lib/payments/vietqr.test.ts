/**
 * Tests for the VietQR payload builder.
 *
 * A malformed payload is rejected silently by the banking app — it just
 * doesn't scan, with no message saying why. So the format has to be verified
 * here rather than discovered at a table with a guest waiting.
 *
 * Run: npm run test:vietqr
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildVietQrPayload, isValidVietQrPayload, crc16 } from "./vietqr.ts";

const base = { bankBin: "970436", accountNumber: "1234567890" };

test("CRC-16/CCITT-FALSE matches the known vector", () => {
  // "123456789" -> 0x29B1 for this variant. Getting the polynomial, init
  // value, reflection or final-xor wrong all produce a payload that looks
  // right and scans to nothing.
  assert.equal(crc16("123456789"), "29B1");
});

test("builds a payload that validates against its own CRC", () => {
  const payload = buildVietQrPayload({ ...base, amountVnd: 170_000, reference: "JCAB12341" });
  assert.equal(isValidVietQrPayload(payload), true);
});

test("a tampered payload fails validation", () => {
  const payload = buildVietQrPayload({ ...base, amountVnd: 170_000 });
  // Change the amount without recomputing the CRC, as a corrupted scan would.
  const tampered = payload.replace("170000", "170001");
  assert.equal(isValidVietQrPayload(tampered), false);
});

test("encodes the amount and reference so the payer confirms rather than types", () => {
  // The whole point of a dynamic QR: half of anyone typing a reference by hand
  // gets it wrong, and then the webhook cannot match the payment to an order.
  const payload = buildVietQrPayload({ ...base, amountVnd: 170_000, reference: "JCAB12341" });
  assert.ok(payload.includes("5406170000"), "amount, tag 54, length 06");
  assert.ok(payload.includes("JCAB12341"), "reference is present");
  assert.ok(payload.startsWith("000201"), "payload format indicator");
  assert.ok(payload.includes("010212"), "point-of-initiation 12 = dynamic");
});

test("without an amount it is a static, reusable code", () => {
  const payload = buildVietQrPayload(base);
  assert.ok(payload.includes("010211"), "11 = static");
  assert.ok(!payload.includes("5406"), "no amount field");
  assert.equal(isValidVietQrPayload(payload), true);
});

test("carries the bank BIN, account and VND currency", () => {
  const payload = buildVietQrPayload({ ...base, amountVnd: 50_000 });
  assert.ok(payload.includes("970436"), "bank BIN");
  assert.ok(payload.includes("1234567890"), "account number");
  assert.ok(payload.includes("5303704"), "currency 704 = VND");
  assert.ok(payload.includes("5802VN"), "country VN");
});

test("refuses input that would produce a silently broken code", () => {
  // Each of these scans to nothing rather than erroring, so they are caught here.
  assert.throws(() => buildVietQrPayload({ ...base, bankBin: "97043" }), /six digits/);
  assert.throws(() => buildVietQrPayload({ ...base, bankBin: "97O436" }), /six digits/);
  assert.throws(() => buildVietQrPayload({ ...base, accountNumber: "12345-678" }), /digits only/);
  // A fractional đồng means a price was computed wrong upstream.
  assert.throws(() => buildVietQrPayload({ ...base, amountVnd: 170_000.5 }), /whole đồng/);
});

test("refuses a field too long for the format to encode", () => {
  // Lengths are two digits, so 99 characters is the hard ceiling. Silently
  // truncating would produce a valid-looking payload paying the wrong account.
  assert.throws(
    () => buildVietQrPayload({ ...base, accountNumber: "1".repeat(100) }),
    /allows 99/
  );
});

test("amounts are exact, including the awkward ones", () => {
  for (const amount of [1_000, 45_000, 170_000, 1_250_000, 9_999_999]) {
    const payload = buildVietQrPayload({ ...base, amountVnd: amount });
    const digits = String(amount);
    assert.ok(
      payload.includes(`54${String(digits.length).padStart(2, "0")}${digits}`),
      `amount ${amount} encoded with correct length`
    );
    assert.equal(isValidVietQrPayload(payload), true);
  }
});
