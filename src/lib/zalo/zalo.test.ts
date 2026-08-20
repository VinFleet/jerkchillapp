/**
 * Tests for the parts of the Zalo integration that can be proven without
 * credentials — which is deliberately most of the parts that go wrong.
 *
 * Run: npm run test:zalo
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeVnPhone, isValidVnPhone, formatVnPhoneForDisplay } from "./phone.ts";
import { isInNightBan, vietnamHour, nextSendableTime } from "./sendWindow.ts";
import { classifyZaloError, unwrapZaloResponse, ZaloError, isNightBanCode } from "./errors.ts";

// ---------- phone ----------

test("normalises every way a Vietnamese number gets typed", () => {
  const expected = "84987654321";
  for (const input of [
    "0987654321",
    "84987654321",
    "+84987654321",
    "+84 987 654 321",
    "(+84) 987-654-321",
    "0987 654 321",
    "987654321",
    "+84 0987654321", // wrong but common: country code AND trunk zero
  ]) {
    assert.equal(normalizeVnPhone(input), expected, `failed on ${input}`);
  }
});

test("rejects numbers that are not reachable", () => {
  for (const bad of ["", "abc", "12", "098765432", "09876543210", "8498765432100"]) {
    assert.equal(normalizeVnPhone(bad), null, `should reject ${bad}`);
    assert.equal(isValidVnPhone(bad), false);
  }
});

test("displays numbers the way Vietnamese staff read them", () => {
  assert.equal(formatVnPhoneForDisplay("+84987654321"), "0987 654 321");
  // Unparseable input comes back untouched rather than mangled.
  assert.equal(formatVnPhoneForDisplay("not a number"), "not a number");
});

// ---------- night window ----------

/** A given wall-clock hour in Vietnam, expressed as a real instant (UTC+7). */
const vnTime = (hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 7, 20, hour - 7, minute));

test("reads the hour in Vietnam, not the server's zone", () => {
  assert.equal(vietnamHour(vnTime(22)), 22);
  assert.equal(vietnamHour(vnTime(0)), 0);
  assert.equal(vietnamHour(vnTime(13)), 13);
});

test("blocks exactly the hours Zalo blocks", () => {
  // The boundaries are what the pre-launch checklist says to test.
  assert.equal(isInNightBan(vnTime(21, 59)), false, "21:59 must be allowed");
  assert.equal(isInNightBan(vnTime(22, 0)), true, "22:00 must be banned");
  assert.equal(isInNightBan(vnTime(5, 59)), true, "05:59 must be banned");
  assert.equal(isInNightBan(vnTime(6, 0)), false, "06:00 must be allowed");

  assert.equal(isInNightBan(vnTime(2)), true);
  assert.equal(isInNightBan(vnTime(12)), false);
});

test("a booking taken after close waits for morning, not forever", () => {
  const queued = nextSendableTime(vnTime(23, 30));
  assert.equal(isInNightBan(queued), false);
  assert.equal(vietnamHour(queued), 6, "should resume at 06:00 Vietnam time");

  // Already open — returns the same instant so callers need no special case.
  const noon = vnTime(12);
  assert.equal(nextSendableTime(noon).getTime(), noon.getTime());
});

// ---------- errors ----------

test("sorts errors into the action you take", () => {
  assert.equal(classifyZaloError(-216), "auth_refresh", "stale token");
  assert.equal(classifyZaloError(-220), "auth_refresh", "expired token");
  assert.equal(classifyZaloError(-135), "auth_human", "OA not permitted to send ZNS");
  assert.equal(classifyZaloError(-137), "auth_human", "ZCA out of money");
  assert.equal(classifyZaloError(-133), "transient", "night ban is retryable tomorrow");
  assert.equal(classifyZaloError(-144), "transient", "daily quota resets");
  assert.equal(classifyZaloError(-108), "permanent", "bad phone number");
  assert.equal(classifyZaloError(-1122), "permanent", "missing template param");
});

test("an unknown code retries rather than losing the message", () => {
  assert.equal(classifyZaloError(-99999), "transient");
});

test("night-ban codes are recognised from either API", () => {
  assert.equal(isNightBanCode(-133), true, "ZNS");
  assert.equal(isNightBanCode(-234), true, "OA");
  assert.equal(isNightBanCode(-108), false);
});

test("a failure that arrives as HTTP 200 is still a failure", () => {
  // This is the trap: Zalo returns 200 with a non-zero error body.
  assert.throws(
    () => unwrapZaloResponse({ error: -108, message: "Phone number is invalid" }),
    (err: unknown) => {
      assert.ok(err instanceof ZaloError);
      assert.equal(err.code, -108);
      assert.equal(err.kind, "permanent");
      return true;
    }
  );
});

test("unwraps a success", () => {
  const data = unwrapZaloResponse<{ msg_id: string }>({
    data: { msg_id: "a4d0243feee163bd3af2" },
    error: 0,
    message: "Success",
  });
  assert.equal(data.msg_id, "a4d0243feee163bd3af2");
});

test("flags the failures that need a person, not a retry", () => {
  assert.equal(new ZaloError(-137, "ZCA out of money").needsAttention, true);
  assert.equal(new ZaloError(-133, "night").needsAttention, false);
  assert.equal(new ZaloError(-133, "night").isNightBan, true);
});
