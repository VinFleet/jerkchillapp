import { supabase } from "@/lib/supabase/client";
import { getBill, getPayments } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getReceiptSettings } from "@/lib/repo/receiptSettings";
import { getPaymentSettings, vietQrConfigured } from "@/lib/repo/paymentSettings";
import { buildVietQrPayload } from "@/lib/payments/vietqr";
import { orderCode } from "@/lib/repo/orderRules";
import type { Order } from "@/lib/types";

/**
 * Handing a ticket to the print bridge.
 *
 * Fire-and-forget by design: the job goes into the queue and the bridge does
 * the rest. A failure returns false and the caller says so, because the
 * fallback — the on-screen print button — only helps someone who knows the
 * auto-print did not happen.
 *
 * Everything is resolved to plain text here, on the device that knows the
 * menu: the bridge should never need the app's data model, only a ticket.
 */

import { getActiveTenant } from "@/lib/storage";

async function enqueue(printer: "kitchen" | "receipt", payload: unknown): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("print_jobs").insert({
    tenant_id: getActiveTenant(),
    printer,
    payload,
  });
  return !error;
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function tableLabel(order: Order): string {
  if (order.customerName) return order.customerName;
  if (!order.tableId) return order.source === "delivery" ? "DELIVERY" : "COUNTER";
  return getCachedTables().find((t) => t.id === order.tableId)?.tableNumber ?? "?";
}

/** The round that was just sent — only those lines, so a second round is a second ticket. */
export function kitchenTicketPayload(order: Order, lineIds: string[]) {
  const menu = getMenuItems(false);
  const nameOf = (id: string) =>
    id.startsWith("adhoc:") ? id.slice(6) : (menu.find((m) => m.id === id)?.name.en ?? id);

  return {
    table: tableLabel(order),
    code: orderCode(order.id),
    time: hhmm(new Date().toISOString()),
    placedBy: order.placedBy ?? "QR — guest ordered",
    notes: [order.orderNote, order.guestNote].filter(Boolean),
    lines: order.lines
      .filter((l) => lineIds.includes(l.id) && l.status !== "cancelled")
      .map((l) => ({
        qty: l.qty,
        name: nameOf(l.menuItemId),
        detail: (l.choices ?? []).map((c) => c.label.en).join(", ") || undefined,
        note: l.note,
      })),
  };
}

export async function printKitchenTicket(order: Order, lineIds: string[]): Promise<boolean> {
  const payload = kitchenTicketPayload(order, lineIds);
  if (payload.lines.length === 0) return true;
  return enqueue("kitchen", payload);
}

export async function printReceipt(order: Order): Promise<boolean> {
  const bill = getBill(order.id);
  if (!bill) return false;
  const menu = getMenuItems(false);
  const receipt = getReceiptSettings();
  const bank = getPaymentSettings();
  const nameOf = (id: string) =>
    id.startsWith("adhoc:") ? id.slice(6) : (menu.find((m) => m.id === id)?.name.en ?? id);

  let qrPayload: string | undefined;
  if (receipt.showPaymentQr && vietQrConfigured() && bill.outstandingVnd > 0) {
    try {
      qrPayload = buildVietQrPayload({
        bankBin: bank.bankBin,
        accountNumber: bank.accountNumber,
        amountVnd: bill.outstandingVnd,
        reference: `JC${orderCode(order.id)}`,
      });
    } catch {
      qrPayload = undefined;
    }
  }

  return enqueue("receipt", {
    headerName: receipt.headerName,
    addressLine: receipt.addressLine,
    metaLine:
      [receipt.phone, receipt.taxCode && `MST ${receipt.taxCode}`].filter(Boolean).join(" - ") ||
      undefined,
    table: tableLabel(order),
    time: hhmm(order.placedAt),
    servedBy: order.placedBy ?? undefined,
    lines: order.lines
      .filter((l) => l.status !== "cancelled")
      .map((l) => ({
        qty: l.qty,
        name: nameOf(l.menuItemId),
        detail: (l.choices ?? []).map((c) => c.label.en).join(", ") || undefined,
        totalVnd: l.unitPriceVnd * l.qty,
      })),
    discount: order.discount
      ? { label: order.discount.label.en, amountVnd: bill.discountVnd }
      : undefined,
    totalVnd: bill.totalVnd,
    payments: getPayments(order.id)
      .filter((p) => p.status === "paid")
      .map((p) => ({ label: p.method, amountVnd: p.amountVnd })),
    outstandingVnd: bill.outstandingVnd,
    qrPayload,
    wifiNote: receipt.wifiNote || undefined,
    footer: `${receipt.footer.en} - ${receipt.footer.vi}`,
  });
}

/** A labelled test ticket, so "did that work" never needs a real order. */
export async function printTest(printer: "kitchen" | "receipt"): Promise<boolean> {
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (printer === "kitchen") {
    return enqueue("kitchen", {
      table: "TEST",
      code: "APP",
      time: now,
      placedBy: "Test from Settings",
      notes: ["IF YOU CAN READ THIS, PRINTING WORKS"],
      lines: [{ qty: 1, name: "Test ticket - Phieu thu" }],
    });
  }
  const receipt = getReceiptSettings();
  return enqueue("receipt", {
    headerName: receipt.headerName,
    addressLine: receipt.addressLine,
    table: "TEST",
    time: now,
    lines: [{ qty: 1, name: "Test receipt - Hoa don thu", totalVnd: 0 }],
    totalVnd: 0,
    outstandingVnd: 0,
    footer: "If you can read this, printing works",
  });
}

export type PrintJobRow = {
  id: string;
  printer: string;
  status: string;
  error: string | null;
  created_at: string;
};

/**
 * The queue's recent tail — how the app knows whether a bridge is alive.
 *
 * There is no heartbeat on purpose: jobs sitting "queued" for more than half
 * a minute IS the bridge being down, told from data that cannot disagree
 * with reality.
 */
export async function recentPrintJobs(limit = 8): Promise<PrintJobRow[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("print_jobs")
    .select("id, printer, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as PrintJobRow[] | null) ?? [];
}
