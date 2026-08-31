import { readList, writeList, newId, todayIso } from "@/lib/storage";
import { getMenuItems } from "@/lib/repo/menu";
import { billState, canCloseOrder, paymentReference } from "@/lib/repo/orderRules";
import type {
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

export function getOrders(): Order[] {
  return readList<Order>(ORDERS_KEY).sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
}

export function getOrder(id: string): Order | undefined {
  return readList<Order>(ORDERS_KEY).find((o) => o.id === id);
}

/** Everything the kitchen still has work on. */
export function getKitchenQueue(): Order[] {
  return getOrders()
    .filter((o) => o.status === "placed" || o.status === "preparing" || o.status === "ready")
    .sort((a, b) => (a.placedAt < b.placedAt ? -1 : 1)); // oldest first — a queue, not a feed
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
  note?: string
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
    unitPriceVnd: price,
    qty: Math.max(1, Math.round(qty)),
    status: "placed",
    note,
  };

  all[idx] = { ...all[idx], lines: [...all[idx].lines, line], updatedAt: new Date().toISOString() };
  writeList(ORDERS_KEY, all);
  return line;
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
  const active = lines.filter((l) => l.status !== "cancelled");
  if (active.length === 0) return current;
  if (active.every((l) => l.status === "served")) return "served";
  if (active.every((l) => l.status === "ready" || l.status === "served")) return "ready";
  if (active.some((l) => l.status === "preparing")) return "preparing";
  return "placed";
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
  return billState(order.lines, getPayments(orderId));
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
