/**
 * What an order costs, and whether it has been paid.
 *
 * Kept import-free so the arithmetic can be proven without a browser, a
 * database or a payment provider. This is the code that decides whether to let
 * a guest walk out, so it is the code most worth being certain about.
 *
 * Money is in whole Vietnamese đồng throughout. There are no subunits in
 * circulation, so there is no rounding to get wrong — but that only holds if
 * nothing ever introduces a fractional amount, which is why the total is
 * asserted to be an integer rather than assumed to be one.
 */

export type Line = {
  id: string;
  unitPriceVnd: number;
  qty: number;
  status: "placed" | "preparing" | "ready" | "served" | "cancelled";
};

export type PaymentRecord = {
  amountVnd: number;
  status: "pending" | "paid" | "failed" | "refunded";
};

/**
 * The bill.
 *
 * Cancelled lines are excluded — a dish sent back or keyed by mistake is not
 * something a guest owes for. Every other status counts, because a guest pays
 * for food that is on its way, not only for food already delivered.
 */
export function orderTotalVnd(lines: Line[]): number {
  const total = lines
    .filter((line) => line.status !== "cancelled")
    .reduce((sum, line) => sum + line.unitPriceVnd * line.qty, 0);

  // A fractional đồng means a price was entered wrong or a discount was
  // applied in the wrong place. Rounding it away would hide that.
  if (!Number.isInteger(total)) {
    throw new Error(`Order total is not a whole đồng: ${total}`);
  }
  return total;
}

/**
 * What has actually been collected.
 *
 * Only `paid` counts. A pending VietQR is a QR someone has been shown, not
 * money in the account, and treating it as settled is how a guest leaves
 * without paying. Refunds subtract; failures are ignored.
 */
export function amountSettledVnd(payments: PaymentRecord[]): number {
  return payments.reduce((sum, p) => {
    if (p.status === "paid") return sum + p.amountVnd;
    if (p.status === "refunded") return sum - p.amountVnd;
    return sum;
  }, 0);
}

export type BillState = {
  /** Before any discount — what the lines add up to. */
  subtotalVnd: number;
  /** What came off. Zero when there is no discount. */
  discountVnd: number;
  /** What the guest actually owes. */
  totalVnd: number;
  settledVnd: number;
  /** Negative when overpaid — worth surfacing rather than clamping to zero. */
  outstandingVnd: number;
  fullyPaid: boolean;
  overpaid: boolean;
  /** Money is in flight: a QR shown, a card authorising. */
  awaitingConfirmation: boolean;
};

export function billState(
  lines: Line[],
  payments: PaymentRecord[],
  discount?: DiscountLike
): BillState {
  const subtotalVnd = orderTotalVnd(lines);
  const discountVnd = discountAmountVnd(subtotalVnd, discount);
  const totalVnd = subtotalVnd - discountVnd;
  const settledVnd = amountSettledVnd(payments);
  const outstandingVnd = totalVnd - settledVnd;

  return {
    subtotalVnd,
    discountVnd,
    totalVnd,
    settledVnd,
    outstandingVnd,
    fullyPaid: outstandingVnd <= 0,
    // Overpayment is usually a split bill paid twice, or a transfer of the
    // wrong amount. Either way somebody is owed change and should be told.
    overpaid: outstandingVnd < 0,
    awaitingConfirmation: payments.some((p) => p.status === "pending"),
  };
}

/**
 * Whether an order may be closed.
 *
 * Deliberately refuses while a payment is pending. A QR that is still
 * unconfirmed at the moment someone taps "close" is the exact case where a
 * till loses money — the guest has scanned, the money has not landed, and
 * closing the order removes the only prompt anyone would have acted on.
 */
export function canCloseOrder(
  lines: Line[],
  payments: PaymentRecord[]
): { ok: true } | { ok: false; reason: "unpaid" | "awaiting_payment" | "empty" } {
  const active = lines.filter((l) => l.status !== "cancelled");
  if (active.length === 0) return { ok: false, reason: "empty" };

  const state = billState(lines, payments);
  if (state.awaitingConfirmation && !state.fullyPaid) {
    return { ok: false, reason: "awaiting_payment" };
  }
  if (!state.fullyPaid) return { ok: false, reason: "unpaid" };
  return { ok: true };
}

/**
 * A payment reference that a bank transfer can carry back to us.
 *
 * Vietnamese bank transfer memos are stripped of diacritics and punctuation by
 * most apps, and truncated. So this is uppercase alphanumeric only, short, and
 * unique enough that two open tables cannot collide.
 */
export function paymentReference(orderId: string, seq: number): string {
  const compact = orderId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-6);
  return `JC${compact}${seq}`;
}

/**
 * What a quantity change means.
 *
 * A waiter pressing "minus" on a single item is not asking for a line of
 * zero — they are taking it off. Storing a zero would leave the kitchen a
 * ticket for nothing and the bill a row worth nothing, and every screen
 * downstream would need to remember to skip it. Deciding it once, here, means
 * none of them do.
 *
 * Fractional quantities round rather than throw: half a portion is a real
 * thing a waiter might key by accident on a number pad, and refusing it
 * mid-service helps nobody. Fractional *money* is a different matter and is
 * still rejected in orderTotalVnd.
 */
export type QtyChange = { action: "set"; qty: number } | { action: "cancel" };

export function resolveQtyChange(requested: number): QtyChange {
  const qty = Math.round(requested);
  return qty < 1 ? { action: "cancel" } : { action: "set", qty };
}

/**
 * Whether an order has been emptied by voiding.
 *
 * An order whose every line was cancelled is not an order any more, and it
 * must not keep its table. Without this the floor screen shows the table
 * occupied at 0d forever: canCloseOrder refuses because the bill is empty, so
 * nothing can free it, and a waiter who voided a mis-keyed round has no way
 * back. Distinguished from "no lines yet", which is a table someone has just
 * opened and is still ordering at.
 */
export function isVoided(lines: Line[]): boolean {
  return lines.length > 0 && lines.every((line) => line.status === "cancelled");
}

// ---------- options and discounts ----------

export type ChoiceLike = { priceDeltaVnd: number };

/**
 * What a line costs once its choices are applied.
 *
 * Deltas are folded into the line's unit price at the moment of ordering, so
 * everything downstream — the bill, the variance report, a refund next week —
 * reads one number and needs to know nothing about options.
 *
 * Floored at zero. A misconfigured delta should make something free, never
 * make the bill go backwards, because a negative line silently pays the guest.
 */
export function linePriceVnd(basePriceVnd: number, choices: ChoiceLike[] = []): number {
  const total = choices.reduce((sum, c) => sum + c.priceDeltaVnd, basePriceVnd);
  if (!Number.isInteger(total)) {
    throw new Error(`Line price is not a whole dong: ${total}`);
  }
  return Math.max(0, total);
}

export type DiscountLike = { kind: "percent" | "amount"; value: number };

/**
 * How much comes off the bill.
 *
 * Two things are load-bearing. It never exceeds the bill, because a discount
 * larger than the total would otherwise produce a negative amount owed and the
 * till would think it owed the guest money. And it returns whole dong: 10% of
 * 155,000 is 15,500 exactly, but 7% is not, and there is no subunit to round
 * into. Rounding is toward the guest's favour on a tie, which is the direction
 * that never leaves someone arguing over a dong at the till.
 */
export function discountAmountVnd(subtotalVnd: number, discount?: DiscountLike): number {
  if (!discount) return 0;
  if (subtotalVnd <= 0) return 0;

  const raw =
    discount.kind === "percent"
      ? (subtotalVnd * clampPercent(discount.value)) / 100
      : discount.value;

  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(subtotalVnd, Math.round(raw));
}

/** A percentage outside 0-100 is a typo, not an instruction. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

// ---------- cash ----------

/**
 * Change owed to the guest.
 *
 * Floored at zero: handing back money on an underpayment is not change, it is
 * a mistake, and the bill simply stays part-paid. Whole dong by construction,
 * because both sides already are.
 */
export function changeDueVnd(receivedVnd: number, owedVnd: number): number {
  if (!Number.isFinite(receivedVnd) || !Number.isFinite(owedVnd)) return 0;
  return Math.max(0, Math.round(receivedVnd) - Math.round(owedVnd));
}

/**
 * The notes a guest is likely to hand over for this bill.
 *
 * Offered as buttons so the common case is one tap rather than typing an
 * amount into a number pad while holding a card machine. Vietnamese notes run
 * 1k / 2k / 5k / 10k / 20k / 50k / 100k / 200k / 500k, so the useful
 * suggestions are the bill rounded up to the next sensible note boundary,
 * plus the exact amount.
 *
 * Deduplicated and capped, because six near-identical buttons is not a
 * shortcut — it is a second decision.
 */
export function cashSuggestionsVnd(owedVnd: number, limit = 5): number[] {
  if (!Number.isFinite(owedVnd) || owedVnd <= 0) return [];
  const owed = Math.round(owedVnd);

  const roundUpTo = (step: number) => Math.ceil(owed / step) * step;
  const candidates = [
    owed,
    roundUpTo(1_000),
    roundUpTo(10_000),
    roundUpTo(50_000),
    roundUpTo(100_000),
    roundUpTo(500_000),
  ];

  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of candidates) {
    if (value < owed || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length === limit) break;
  }
  return out;
}
