import { readList, writeList, newId, todayIso, isSeeded, markSeeded } from "@/lib/storage";
import { getMenuItems } from "@/lib/repo/menu";
import {
  billState,
  canCloseOrder,
  paymentReference,
  resolveQtyChange,
  isVoided,
  linePriceVnd,
  canSplitOrder,
  canMergeOrders,
} from "@/lib/repo/orderRules";
import type {
  OrderLineChoice,
  OrderDiscount,
  Order,
  OrderLine,
  OrderSource,
  OrderStatus,
  OrderLineStatus,
  Payment,
  PaymentMethod,
  MenuChannel,
} from "@/lib/types";

/**
 * Orders and payments.
 *
 * Local-first like everything else: an order taken on a dead connection still
 * reaches the kitchen when the tablet reconnects. Both collections sync as
 * operational data (last-write-wins) rather than append-only — an order is a
 * living record that changes as food moves, unlike a food-safety log.
 *
 * Payments are the exception in spirit: a confirmed payment is never edited,
 * only superseded by a refund record. That is a convention here rather than a
 * database trigger, because the money of record lives with the bank and the
 * payment provider, not in this table.
 */

const ORDERS_KEY = "orders";
const PAYMENTS_KEY = "order_payments";

// ---------- reading ----------

const VOIDED_REPAIR_KEY = "orders_voided_repair_v1";

/**
 * Close out orders that were emptied before deriveOrderStatus knew to.
 *
 * The status is derived when a line changes, so an order whose every line was
 * already cancelled kept "placed" and held its table at 0d with nothing able
 * to free it. New voids are handled at the source; these are the ones already
 * stuck, and they will not fix themselves because nothing is going to touch
 * their lines again.
 */
export function repairVoidedOrders() {
  if (isSeeded(VOIDED_REPAIR_KEY)) return;
  const all = readList<Order>(ORDERS_KEY);
  let changed = false;
  const fixed = all.map((order) => {
    if (order.status === "closed" || order.status === "cancelled") return order;
    if (!isVoided(order.lines)) return order;
    changed = true;
    return { ...order, status: "cancelled" as OrderStatus, updatedAt: new Date().toISOString() };
  });
  if (changed) writeList(ORDERS_KEY, fixed);
  markSeeded(VOIDED_REPAIR_KEY);
}

export function getOrders(): Order[] {
  return readList<Order>(ORDERS_KEY).sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
}

export function getOrder(id: string): Order | undefined {
  return readList<Order>(ORDERS_KEY).find((o) => o.id === id);
}

/** Everything the kitchen still has work on. */
export function getKitchenQueue(): Order[] {
  return getOrders()
    .filter((o) => o.status !== "closed" && o.status !== "cancelled")
    // Only rounds the waiter actually sent. A line still being keyed is not
    // the kitchen's business, and a ticket that grows and shrinks while a
    // chef reads it is worse than one that arrives late.
    .filter((o) => o.lines.some((l) => l.sentAt && l.status !== "cancelled"))
    .sort((a, b) => (a.placedAt < b.placedAt ? -1 : 1));
}

/** Lines the waiter has keyed but not yet sent. */
export function unsentLines(order: Order) {
  return order.lines.filter((l) => !l.sentAt && l.status !== "cancelled");
}

/**
 * Send the round to the kitchen.
 *
 * Stamps every unsent line at once, so a round arrives as a round. Returns
 * how many went, which is what the waiter is told — silence after tapping
 * "send" is indistinguishable from a broken button.
 */
export function sendToKitchen(orderId: string): number {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return 0;

  const now = new Date().toISOString();
  let sent = 0;
  const lines = all[idx].lines.map((l) => {
    if (l.sentAt || l.status === "cancelled") return l;
    sent += 1;
    return { ...l, sentAt: now };
  });
  if (sent === 0) return 0;

  all[idx] = { ...all[idx], lines, updatedAt: now };
  writeList(ORDERS_KEY, all);
  return sent;
}

/** Orders still open on a table, for the floor view. */
export function getOpenOrderForTable(tableId: string): Order | undefined {
  return getOrders().find(
    (o) => o.tableId === tableId && o.status !== "closed" && o.status !== "cancelled"
  );
}

export function getOrdersForDate(date: string): Order[] {
  return getOrders().filter((o) => o.placedAt.slice(0, 10) === date);
}

// ---------- writing ----------

export function createOrder(input: {
  tableId: string | null;
  source: OrderSource;
  channel: MenuChannel;
  placedBy: string | null;
  guestNote?: string;
}): Order {
  const now = new Date().toISOString();
  const order: Order = {
    id: newId("order"),
    tableId: input.tableId,
    source: input.source,
    channel: input.channel,
    status: "placed",
    lines: [],
    placedAt: now,
    placedBy: input.placedBy,
    guestNote: input.guestNote,
    updatedAt: now,
  };
  writeList(ORDERS_KEY, [...readList<Order>(ORDERS_KEY), order]);
  return order;
}

/**
 * Add a line, pricing it from the menu at this moment.
 *
 * The price is copied onto the line rather than referenced, so a price change
 * tonight cannot rewrite a bill a guest already agreed to.
 */
export function addLine(
  orderId: string,
  menuItemId: string,
  qty: number,
  note?: string,
  /** Spice level, mocktail — copied onto the line with their price effect. */
  choices?: OrderLineChoice[]
): OrderLine | null {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;

  const item = getMenuItems().find((m) => m.id === menuItemId);
  if (!item) return null;

  const price = item.pricesVnd[all[idx].channel];
  // A null price means this item is not sold on this channel. Selling it at
  // zero would be worse than refusing.
  if (price === null || price === undefined) return null;

  const line: OrderLine = {
    id: newId("line"),
    menuItemId,
    // Deltas are folded in now, so nothing downstream needs to know this line
    // had options at all.
    unitPriceVnd: linePriceVnd(price, choices ?? []),
    qty: Math.max(1, Math.round(qty)),
    status: "placed",
    note,
    choices: choices?.length ? choices : undefined,
  };

  all[idx] = { ...all[idx], lines: [...all[idx].lines, line], updatedAt: new Date().toISOString() };
  writeList(ORDERS_KEY, all);
  return line;
}

/**
 * Change how many of a line.
 *
 * Separate from addLine because they are different events: adding is a guest
 * asking for another, and this is a correction. Going below one cancels the
 * line rather than storing a zero — a line of nothing is not something the
 * kitchen or the bill should have to interpret.
 */
export function setLineQty(orderId: string, lineId: string, qty: number) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;

  const change = resolveQtyChange(qty);
  const lines = all[idx].lines.map((l) =>
    l.id === lineId
      ? change.action === "cancel"
        ? { ...l, status: "cancelled" as OrderLineStatus }
        : { ...l, qty: change.qty }
      : l
  );

  all[idx] = {
    ...all[idx],
    lines,
    status: deriveOrderStatus(all[idx].status, lines),
    updatedAt: new Date().toISOString(),
  };
  writeList(ORDERS_KEY, all);
}

export function setLineStatus(orderId: string, lineId: string, status: OrderLineStatus) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;

  const lines = all[idx].lines.map((l) => (l.id === lineId ? { ...l, status } : l));
  all[idx] = { ...all[idx], lines, status: deriveOrderStatus(all[idx].status, lines), updatedAt: new Date().toISOString() };
  writeList(ORDERS_KEY, all);
}

/**
 * The order's own status follows its lines.
 *
 * Kept as a derivation rather than something the kitchen sets separately: two
 * places to record the same fact is how a ticket shows "ready" with a line
 * still cooking. `closed` and `cancelled` are decisions, not derivations, so
 * they are never overwritten here.
 */
function deriveOrderStatus(current: OrderStatus, lines: OrderLine[]): OrderStatus {
  if (current === "closed" || current === "cancelled") return current;
  // Every line voided means the order is gone, not merely empty — otherwise
  // the table stays occupied at 0d with nothing able to close it.
  if (isVoided(lines)) return "cancelled";
  const active = lines.filter((l) => l.status !== "cancelled");
  if (active.length === 0) return current;
  if (active.every((l) => l.status === "served")) return "served";
  if (active.every((l) => l.status === "ready" || l.status === "served")) return "ready";
  if (active.some((l) => l.status === "preparing")) return "preparing";
  return "placed";
}

/**
 * Move an order to a different table.
 *
 * Guests move — a two-top becomes a four-top, or a booking lands on the table
 * someone sat at. Without this the only way out is to void the round and key
 * it again, which loses the kitchen ticket that is already cooking.
 */
/** An allergy or a preference for the whole table. */
export function setOrderNote(orderId: string, note: string) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  const trimmed = note.trim().slice(0, 300);
  all[idx] = {
    ...all[idx],
    orderNote: trimmed || undefined,
    updatedAt: new Date().toISOString(),
  };
  writeList(ORDERS_KEY, all);
}

/**
 * A note on one line.
 *
 * Editable after the fact because most items add in a single tap and never
 * open the panel — "no onion" on a coleslaw is asked at the table, not
 * chosen from a menu.
 */
export function setLineNote(orderId: string, lineId: string, note: string) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  const trimmed = note.trim().slice(0, 200);
  const lines = all[idx].lines.map((l) =>
    l.id === lineId ? { ...l, note: trimmed || undefined } : l
  );
  all[idx] = { ...all[idx], lines, updatedAt: new Date().toISOString() };
  writeList(ORDERS_KEY, all);
}

export function moveOrderToTable(orderId: string, tableId: string) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], tableId, updatedAt: new Date().toISOString() };
  writeList(ORDERS_KEY, all);
}

/**
 * Move some lines onto a bill of their own.
 *
 * The classic "we'll pay separately". The new order inherits the table and
 * the channel, and the lines keep their sentAt — the kitchen has already
 * cooked them and must not see them twice.
 *
 * The discount deliberately stays with the original: it was applied to a
 * bill that no longer exists in the same shape, and silently re-applying a
 * percentage to both halves would give away more than anyone agreed to.
 */
export function splitOrder(
  orderId: string,
  lineIds: string[],
  placedBy: string | null
): { ok: true; newOrderId: string } | { ok: false; reason: string } {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return { ok: false, reason: "missing" };

  const source = all[idx];
  const verdict = canSplitOrder(source.status, source.lines, lineIds, getPayments(orderId));
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const now = new Date().toISOString();
  const moving = source.lines.filter((l) => lineIds.includes(l.id));
  const staying = source.lines.filter((l) => !lineIds.includes(l.id));

  const split: Order = {
    id: newId("order"),
    tableId: source.tableId,
    source: source.source,
    channel: source.channel,
    status: "placed",
    lines: moving,
    placedAt: source.placedAt,
    placedBy,
    updatedAt: now,
  };

  all[idx] = { ...source, lines: staying, updatedAt: now };
  writeList(ORDERS_KEY, [...all, split]);
  return { ok: true, newOrderId: split.id };
}

/**
 * Fold one bill into another.
 *
 * For two tables that pushed together. The absorbed order is cancelled rather
 * than deleted, so its history survives — and its lines keep their sentAt for
 * the same reason as a split.
 */
export function mergeOrders(
  intoId: string,
  fromId: string
): { ok: true } | { ok: false; reason: string } {
  const all = readList<Order>(ORDERS_KEY);
  const intoIdx = all.findIndex((o) => o.id === intoId);
  const fromIdx = all.findIndex((o) => o.id === fromId);
  if (intoIdx < 0 || fromIdx < 0) return { ok: false, reason: "missing" };

  const verdict = canMergeOrders(
    intoId,
    fromId,
    all[intoIdx].status,
    all[fromIdx].status,
    [...getPayments(intoId), ...getPayments(fromId)]
  );
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const now = new Date().toISOString();
  const notes = [all[intoIdx].orderNote, all[fromIdx].orderNote].filter(Boolean).join(" · ");

  all[intoIdx] = {
    ...all[intoIdx],
    lines: [...all[intoIdx].lines, ...all[fromIdx].lines],
    // Both tables' notes survive. Losing an allergy note in a merge is the
    // one outcome this must never have.
    orderNote: notes || undefined,
    updatedAt: now,
  };
  all[fromIdx] = { ...all[fromIdx], status: "cancelled", lines: [], updatedAt: now };
  writeList(ORDERS_KEY, all);
  return { ok: true };
}

/**
 * An item that is not on the menu.
 *
 * Specials, a corkage charge, a plate the kitchen improvised. Priced by the
 * person adding it, named in English only because they are typing it
 * one-handed — a Vietnamese name can be added when it becomes a real menu
 * item, and pretending otherwise would just produce two copies of the
 * English.
 */
export function addAdHocLine(
  orderId: string,
  name: string,
  priceVnd: number,
  qty: number
): OrderLine | null {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;

  const line: OrderLine = {
    id: newId("line"),
    // Not a menu id: nothing in the menu matches, and the variance report
    // needs to be able to tell these apart from a real dish.
    menuItemId: `adhoc:${name.trim().slice(0, 60)}`,
    unitPriceVnd: Math.max(0, Math.round(priceVnd)),
    qty: Math.max(1, Math.round(qty)),
    status: "placed",
  };

  all[idx] = {
    ...all[idx],
    lines: [...all[idx].lines, line],
    updatedAt: new Date().toISOString(),
  };
  writeList(ORDERS_KEY, all);
  return line;
}

/** Who is sitting there, when it is worth recording. */
export function setOrderCustomer(orderId: string, name: string, phone?: string) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    customerName: name.trim().slice(0, 120) || undefined,
    customerPhone: phone?.trim().slice(0, 32) || undefined,
    updatedAt: new Date().toISOString(),
  };
  writeList(ORDERS_KEY, all);
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
  writeList(ORDERS_KEY, all);
}

// ---------- payments ----------

export function getPayments(orderId: string): Payment[] {
  return readList<Payment>(PAYMENTS_KEY).filter((p) => p.orderId === orderId);
}

export function getBill(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return null;
  return billState(order.lines, getPayments(orderId), order.discount);
}

/**
 * Put money off the bill, or take it off again.
 *
 * Stamped with who and when, because "why did table six pay less" is asked
 * when the takings are counted, not while the guest is still sitting there.
 */
export function setDiscount(
  orderId: string,
  discount: OrderDiscount | null
): void {
  const all = readList<Order>(ORDERS_KEY);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    discount: discount ?? undefined,
    updatedAt: new Date().toISOString(),
  };
  writeList(ORDERS_KEY, all);
}

/**
 * Start a payment.
 *
 * Cash is confirmed immediately — it is in the drawer. Everything else opens
 * as `pending` and waits for a provider webhook, because a QR on screen is not
 * money in the account.
 */
export function takePayment(input: {
  orderId: string;
  method: PaymentMethod;
  amountVnd: number;
  takenBy: string | null;
  /**
   * The card terminal's own reference, typed off the slip.
   *
   * The terminal settles separately from this app, so at close the two have
   * to be reconciled by hand. Without a shared reference that means matching
   * on amount and rough time, which stops working the moment two tables pay
   * the same amount within a few minutes — which on a set menu is most of a
   * Sunday.
   */
  providerRef?: string;
}): Payment {
  const existing = getPayments(input.orderId);
  const payment: Payment = {
    id: newId("pay"),
    orderId: input.orderId,
    method: input.method,
    amountVnd: Math.round(input.amountVnd),
    status: input.method === "cash" ? "paid" : "pending",
    reference: paymentReference(input.orderId, existing.length + 1),
    takenBy: input.takenBy,
    createdAt: new Date().toISOString(),
    confirmedAt: input.method === "cash" ? new Date().toISOString() : undefined,
    providerRef: input.providerRef?.trim() || undefined,
  };
  writeList(PAYMENTS_KEY, [...readList<Payment>(PAYMENTS_KEY), payment]);
  return payment;
}

/**
 * Mark a payment confirmed, from a provider webhook.
 *
 * Matched on our reference, which is what the bank memo carries back. Returns
 * false when nothing matches — a transfer arriving with a reference no order
 * claims is a real situation (someone mistyped) and must be visible rather
 * than silently dropped.
 */
export function confirmPaymentByReference(
  reference: string,
  providerRef: string,
  provider: string
): boolean {
  const all = readList<Payment>(PAYMENTS_KEY);
  const idx = all.findIndex((p) => p.reference === reference && p.status === "pending");
  if (idx < 0) return false;

  all[idx] = {
    ...all[idx],
    status: "paid",
    providerRef,
    provider,
    confirmedAt: new Date().toISOString(),
  };
  writeList(PAYMENTS_KEY, all);
  return true;
}

/** Attach a photographed card slip to a payment. */
export function setPaymentSlip(paymentId: string, path: string) {
  const all = readList<Payment>(PAYMENTS_KEY);
  const idx = all.findIndex((p) => p.id === paymentId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], slipPhotoPath: path };
  writeList(PAYMENTS_KEY, all);
}

export function failPayment(paymentId: string, detail: string) {
  const all = readList<Payment>(PAYMENTS_KEY);
  const idx = all.findIndex((p) => p.id === paymentId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status: "failed", failureDetail: detail.slice(0, 300) };
  writeList(PAYMENTS_KEY, all);
}

/** Close an order, refusing while money is unsettled or in flight. */
export function closeOrder(orderId: string): ReturnType<typeof canCloseOrder> {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "empty" };

  const verdict = canCloseOrder(order.lines, getPayments(orderId));
  if (verdict.ok) setOrderStatus(orderId, "closed");
  return verdict;
}

/** Today's takings by method, for the sales module and the Z-report. */
export function takingsForDate(date = todayIso()): Record<PaymentMethod, number> {
  const orderIds = new Set(getOrdersForDate(date).map((o) => o.id));
  const totals: Record<PaymentMethod, number> = { cash: 0, vietqr: 0, card: 0 };
  for (const p of readList<Payment>(PAYMENTS_KEY)) {
    if (!orderIds.has(p.orderId)) continue;
    if (p.status === "paid") totals[p.method] += p.amountVnd;
    if (p.status === "refunded") totals[p.method] -= p.amountVnd;
  }
  return totals;
}
