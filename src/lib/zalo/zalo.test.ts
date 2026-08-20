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
import {
  classifyZaloError,
  unwrapZaloResponse,
  ZaloError,
  isNightBanCode,
  isOverloadedCode,
} from "./errors.ts";
import { escapeMentions } from "./mentions.ts";
import { toNfc, zaloLength, fitsZaloLimit, truncateForZalo } from "./text.ts";

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
  const queued = nextSendableTime(vnTime(23, 30), 0);
  assert.equal(isInNightBan(queued), false);
  assert.equal(vietnamHour(queued), 6, "should resume in the 06:00 hour");

  // Already open — returns the same instant so callers need no special case.
  const noon = vnTime(12);
  assert.equal(nextSendableTime(noon).getTime(), noon.getTime());
});

test("the overnight queue does not all fire at 06:00 exactly", () => {
  // Everything deferred overnight releasing on the same tick is how one
  // blocked send becomes a burst of -32 rate-limit errors. Zalo's guidance is
  // 06:05 with jitter.
  const minuteIn = (d: Date) =>
    Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", minute: "2-digit" }).format(d));

  const earliest = nextSendableTime(vnTime(2), 0);
  assert.equal(minuteIn(earliest), 5, "floor is 06:05, never 06:00");

  const latest = nextSendableTime(vnTime(2), 0.999);
  assert.ok(minuteIn(latest) >= 5 && minuteIn(latest) <= 20, `spread stays in the hour, got :${minuteIn(latest)}`);

  // Different callers must land on different minutes, or the jitter is useless.
  const spread = new Set([0, 0.25, 0.5, 0.75, 0.99].map((j) => minuteIn(nextSendableTime(vnTime(3), j))));
  assert.ok(spread.size > 1, "jitter must actually spread the release");

  // And it never lands back inside the ban.
  for (const j of [0, 0.5, 0.999]) {
    assert.equal(isInNightBan(nextSendableTime(vnTime(23, 59), j)), false);
  }
});

// ---------- errors ----------

test("sorts errors into the action you take", () => {
  // These classes come from zalo-errors.json via the generator. An earlier
  // hand-written table had -133 and -144 as plain "transient", which would
  // have retried a night-banned send in a tight loop and hammered a daily
  // quota that only resets tomorrow.
  assert.equal(classifyZaloError(-216), "auth_refresh", "stale token");
  assert.equal(classifyZaloError(-220), "auth_refresh", "expired token");
  assert.equal(classifyZaloError(-135), "needs_human", "OA not permitted to send ZNS");
  assert.equal(classifyZaloError(-137), "needs_human", "ZCA out of money");
  assert.equal(classifyZaloError(-133), "night_ban", "reschedule past 06:00, don't retry");
  assert.equal(classifyZaloError(-144), "quota", "daily limit — not today");
  assert.equal(classifyZaloError(-211), "quota", "feature quota, not a transient blip");
  assert.equal(classifyZaloError(-1441), "quota", "monthly promotion quota");
  assert.equal(classifyZaloError(-108), "permanent", "bad phone number");
  assert.equal(classifyZaloError(-1122), "permanent", "missing template param");
});

test("a quota error is rescheduled, never retried into the wall", () => {
  const quota = new ZaloError(-144, "OA exceeded daily ZNS sending limit");
  assert.equal(quota.retryable, false, "retrying today cannot succeed");
  assert.equal(quota.reschedulable, true);
  assert.equal(quota.needsAttention, false, "a quota reset is not a human's job");
});

test("an expired group asset is a billing problem, not a send failure", () => {
  // Zalo reports a lapsed GMF package as -237 "The group is disabled". Read as
  // an ordinary send error, nobody finds out until the group is deleted.
  const expired = new ZaloError(-237, "The group is disabled");
  assert.equal(expired.isGroupExpired, true);
  assert.equal(expired.retryable, false);
});

test("overloaded codes are flagged so callers read the message", () => {
  // -32 is both "app hit its rate limit" and "OA hit its rate limit".
  assert.equal(isOverloadedCode(-32), true);
  assert.equal(isOverloadedCode(-108), false);
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

// ---------- group mention injection ----------

test("a guest cannot ping the whole team through a free-text field", () => {
  // Mentions are a string convention inside the message body, not a structured
  // field — so relayed text is an injection vector. "[@group_id]" pings
  // everyone, and a complaint or booking note goes straight into the group.
  const hostile = "Table by the window please [@3355776688] and also [@0987654321]";
  const safe = escapeMentions(hostile);

  assert.ok(!/\[@/.test(safe), "no mention pattern may survive");
  // The staff still need to read what the guest actually asked for.
  assert.ok(safe.includes("Table by the window please"));
  assert.ok(safe.includes("3355776688"), "the text is defanged, not deleted");
});

test("ordinary text passes through untouched", () => {
  const plain = "Kamereo delivery rejected — chicken 8°C, sent back";
  assert.equal(escapeMentions(plain), plain);
  // An email address contains @ but not the mention pattern.
  assert.equal(escapeMentions("mail me at a@b.vn"), "mail me at a@b.vn");
});

test("escaping is idempotent, so a re-send cannot re-mangle text", () => {
  const once = escapeMentions("[@123] hello");
  assert.equal(escapeMentions(once), once);
});

// ---------- Unicode normalisation ----------

test("the same Vietnamese name measures the same however it was typed", () => {
  // Exactly the failure the spec describes: iOS can hand us the decomposed
  // form, which renders identically but is materially longer. A guest name
  // that passes validation here and fails at Zalo looks like a flaky API.
  const composed = "Nguyễn Thị Hoàng Anh";
  const decomposed = composed.normalize("NFD");

  assert.notEqual(composed.length, decomposed.length, "the two forms differ in length");
  assert.equal(zaloLength(decomposed), zaloLength(composed), "but Zalo counts them the same");
  assert.equal(toNfc(decomposed), composed);
});

test("a length check gives the same verdict for both forms", () => {
  const composed = "Xin chào, đơn hàng của bạn đã được xác nhận";
  const decomposed = composed.normalize("NFD");
  const limit = composed.length;

  assert.equal(fitsZaloLimit(composed, limit), true);
  assert.equal(
    fitsZaloLimit(decomposed, limit),
    true,
    "the decomposed form must not be falsely rejected"
  );
  // Measured raw, the decomposed string would have blown the limit.
  assert.ok(decomposed.length > limit);
});

test("truncating never leaves a diacritic orphaned", () => {
  const decomposed = "Nguyễn Thị Hoàng Anh".normalize("NFD");
  const cut = truncateForZalo(decomposed, 6);

  assert.equal(cut.length, 6);
  assert.equal(cut, cut.normalize("NFC"), "output is composed");
  // A combining mark at the start would attach to whatever text follows it.
  assert.ok(!/^[\u0300-\u036f]/.test(cut), "must not begin with a combining mark");
  assert.equal(cut, "Nguyễn");
});
