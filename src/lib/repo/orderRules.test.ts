/**
 * Tests for the bill arithmetic and the close-order guard.
 *
 * This is the code that decides whether a guest may walk out, so the cases
 * below are the ones where a till loses money.
 *
 * Run: npm run test:orders
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  orderTotalVnd,
  amountSettledVnd,
  billState,
  canCloseOrder,
  paymentReference,
  resolveQtyChange,
  isVoided,
  linePriceVnd,
  discountAmountVnd,
  type Line,
  type PaymentRecord,
} from "./orderRules.ts";

const line = (over: Partial<Line> = {}): Line => ({
  id: "l1",
  unitPriceVnd: 170_000,
  qty: 1,
  status: "placed",
  ...over,
});

const pay = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  amountVnd: 170_000,
  status: "paid",
  ...over,
});

// ---------- the bill ----------

test("totals the lines", () => {
  assert.equal(
    orderTotalVnd([line({ qty: 2 }), line({ id: "l2", unitPriceVnd: 45_000, qty: 3 })]),
    475_000
  );
});

test("a cancelled line is not owed for", () => {
  // A dish sent back, or keyed by mistake. Charging for it is the bug.
  const lines = [line({ qty: 1 }), line({ id: "l2", qty: 1, status: "cancelled" })];
  assert.equal(orderTotalVnd(lines), 170_000);
});

test("food still coming is still owed for", () => {
  // A guest pays for the whole order, not only what has reached the table.
  for (const status of ["placed", "preparing", "ready", "served"] as const) {
    assert.equal(orderTotalVnd([line({ status })]), 170_000, status);
  }
});

test("refuses a fractional đồng rather than rounding it away", () => {
  // There are no subunits in circulation, so a fraction means a price was
  // entered wrong. Rounding would hide it.
  assert.throws(() => orderTotalVnd([line({ unitPriceVnd: 170_000.5 })]), /whole đồng/);
});

// ---------- what has actually been collected ----------

test("only confirmed money counts", () => {
  // The case that matters: a QR has been shown but nothing has landed.
  assert.equal(amountSettledVnd([pay({ status: "pending" })]), 0);
  assert.equal(amountSettledVnd([pay({ status: "failed" })]), 0);
  assert.equal(amountSettledVnd([pay({ status: "paid" })]), 170_000);
});

test("a refund comes back off", () => {
  assert.equal(
    amountSettledVnd([pay({ amountVnd: 200_000 }), pay({ amountVnd: 50_000, status: "refunded" })]),
    150_000
  );
});

test("split payments add up", () => {
  const state = billState(
    [line({ unitPriceVnd: 300_000 })],
    [pay({ amountVnd: 100_000 }), pay({ amountVnd: 200_000 })]
  );
  assert.equal(state.settledVnd, 300_000);
  assert.equal(state.fullyPaid, true);
  assert.equal(state.outstandingVnd, 0);
});

test("overpayment is surfaced, not clamped", () => {
  // Usually a split bill paid twice, or a transfer of the wrong amount.
  // Somebody is owed change and should be told.
  const state = billState([line({ unitPriceVnd: 100_000 })], [pay({ amountVnd: 150_000 })]);
  assert.equal(state.overpaid, true);
  assert.equal(state.outstandingVnd, -50_000);
});

// ---------- the guard that stops money walking out ----------

test("will not close an unpaid order", () => {
  const result = canCloseOrder([line()], []);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "unpaid");
});

test("will not close while a payment is still unconfirmed", () => {
  // The expensive case. The guest has scanned, the money has not landed, and
  // closing removes the only prompt anyone would have acted on.
  const result = canCloseOrder([line()], [pay({ status: "pending" })]);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "awaiting_payment");
});

test("closes when the bill is settled", () => {
  assert.equal(canCloseOrder([line()], [pay()]).ok, true);
});

test("a stale pending alongside full payment does not block closing", () => {
  // A QR shown, then the guest paid cash instead. The bill is settled; the
  // abandoned QR must not hold the table open.
  const result = canCloseOrder([line()], [pay({ status: "pending" }), pay()]);
  assert.equal(result.ok, true);
});

test("an order of nothing cannot be closed", () => {
  assert.equal(canCloseOrder([], []).ok, false);
  assert.equal(canCloseOrder([line({ status: "cancelled" })], []).ok, false);
});

// ---------- the transfer reference ----------

test("a reference survives a Vietnamese bank memo", () => {
  // Banking apps strip diacritics and punctuation and truncate. Anything that
  // does not survive that cannot be matched back by the webhook.
  const ref = paymentReference("order_a1b2-c3d4", 1);
  assert.match(ref, /^[A-Z0-9]+$/, "uppercase alphanumeric only");
  assert.ok(ref.length <= 12, `short enough to survive truncation, got ${ref.length}`);
  assert.ok(ref.startsWith("JC"), "identifiable as ours among other transfers");
});

test("two open tables cannot collide", () => {
  assert.notEqual(paymentReference("order_aaaaaa", 1), paymentReference("order_bbbbbb", 1));
  // Same order, second attempt — a re-shown QR must not look like the first.
  assert.notEqual(paymentReference("order_aaaaaa", 1), paymentReference("order_aaaaaa", 2));
});

// ---------- changing a quantity ----------

test("minus on the last one takes the line off, rather than storing a zero", () => {
  assert.deepEqual(resolveQtyChange(0), { action: "cancel" });
  assert.deepEqual(resolveQtyChange(-1), { action: "cancel" });
});

test("an ordinary quantity is kept as typed", () => {
  assert.deepEqual(resolveQtyChange(1), { action: "set", qty: 1 });
  assert.deepEqual(resolveQtyChange(12), { action: "set", qty: 12 });
});

test("a fractional quantity rounds instead of throwing mid-service", () => {
  assert.deepEqual(resolveQtyChange(2.4), { action: "set", qty: 2 });
  assert.deepEqual(resolveQtyChange(2.6), { action: "set", qty: 3 });
  // Rounds to zero, so it cancels — not a line of nothing.
  assert.deepEqual(resolveQtyChange(0.4), { action: "cancel" });
});

test("a cancelled line stops counting toward the bill", () => {
  // The reason the rule exists: the total must follow the cancel.
  const before = orderTotalVnd([line({ unitPriceVnd: 50_000, qty: 1 })]);
  const after = orderTotalVnd([line({ unitPriceVnd: 50_000, qty: 1, status: "cancelled" })]);
  assert.equal(before, 50_000);
  assert.equal(after, 0);
});

// ---------- voiding every line ----------

test("an order with every line voided is not an empty order, it is gone", () => {
  // The bug this exists for: the table showed occupied at 0d forever, and
  // canCloseOrder refused because the bill was empty, so nothing could free it.
  assert.equal(isVoided([line({ status: "cancelled" }), line({ status: "cancelled" })]), true);
});

test("a table someone is still ordering at is not voided", () => {
  assert.equal(isVoided([]), false, "no lines yet is a new table, not a void");
  assert.equal(isVoided([line({ status: "placed" }), line({ status: "cancelled" })]), false);
});

// ---------- option pricing ----------

test("a mocktail costs less than the cocktail it came from", () => {
  assert.equal(linePriceVnd(130_000, [{ priceDeltaVnd: -45_000 }]), 85_000);
});

test("no choices leaves the price alone", () => {
  assert.equal(linePriceVnd(210_000), 210_000);
  assert.equal(linePriceVnd(210_000, []), 210_000);
});

test("choices stack", () => {
  assert.equal(linePriceVnd(100_000, [{ priceDeltaVnd: 10_000 }, { priceDeltaVnd: 5_000 }]), 115_000);
});

test("a misconfigured delta makes something free, never negative", () => {
  // A negative line would silently pay the guest.
  assert.equal(linePriceVnd(50_000, [{ priceDeltaVnd: -80_000 }]), 0);
});

// ---------- discounts ----------

test("a percentage comes off the bill", () => {
  assert.equal(discountAmountVnd(500_000, { kind: "percent", value: 10 }), 50_000);
});

test("money off comes off the bill", () => {
  assert.equal(discountAmountVnd(500_000, { kind: "amount", value: 80_000 }), 80_000);
});

test("a discount never exceeds the bill", () => {
  // Otherwise outstanding goes negative and the till thinks it owes the guest.
  assert.equal(discountAmountVnd(50_000, { kind: "amount", value: 200_000 }), 50_000);
  assert.equal(discountAmountVnd(50_000, { kind: "percent", value: 100 }), 50_000);
});

test("a percentage outside 0-100 is a typo, not an instruction", () => {
  assert.equal(discountAmountVnd(100_000, { kind: "percent", value: 150 }), 100_000);
  assert.equal(discountAmountVnd(100_000, { kind: "percent", value: -10 }), 0);
});

test("a discount is always whole dong", () => {
  // 7% of 155,000 is 10,850 exactly; 7% of 155,555 is not a whole dong, and
  // there is no subunit to round into.
  for (const subtotal of [155_000, 155_555, 99_999, 1]) {
    const d = discountAmountVnd(subtotal, { kind: "percent", value: 7 });
    assert.ok(Number.isInteger(d), `${subtotal} gave ${d}`);
  }
});

test("no discount, or an empty bill, takes nothing off", () => {
  assert.equal(discountAmountVnd(100_000, undefined), 0);
  assert.equal(discountAmountVnd(0, { kind: "percent", value: 50 }), 0);
  assert.equal(discountAmountVnd(-5, { kind: "amount", value: 10 }), 0);
});

test("the bill reports what came off, not just the reduced total", () => {
  // A total that silently shrank cannot answer "why did table six pay less".
  const b = billState([line({ unitPriceVnd: 100_000, qty: 2 })], [], {
    kind: "percent",
    value: 10,
  });
  assert.equal(b.subtotalVnd, 200_000);
  assert.equal(b.discountVnd, 20_000);
  assert.equal(b.totalVnd, 180_000);
  assert.equal(b.outstandingVnd, 180_000);
});

test("a fully discounted bill is settled, not stuck", () => {
  const b = billState([line({ unitPriceVnd: 100_000, qty: 1 })], [], {
    kind: "percent",
    value: 100,
  });
  assert.equal(b.totalVnd, 0);
  assert.equal(b.fullyPaid, true, "nothing owed means nothing to collect");
});
