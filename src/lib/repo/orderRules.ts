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
  totalVnd: number;
  settledVnd: number;
  /** Negative when overpaid — worth surfacing rather than clamping to zero. */
  outstandingVnd: number;
  fullyPaid: boolean;
  overpaid: boolean;
  /** Money is in flight: a QR shown, a card authorising. */
  awaitingConfirmation: boolean;
};

export function billState(lines: Line[], payments: PaymentRecord[]): BillState {
  const totalVnd = orderTotalVnd(lines);
  const settledVnd = amountSettledVnd(payments);
  const outstandingVnd = totalVnd - settledVnd;

  return {
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
