import { supabase } from "@/lib/supabase/client";
import { getBill, getPayments } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getReceiptSettings } from "@/lib/repo/receiptSettings";
import { getPaymentSettings, vietQrConfigured } from "@/lib/repo/paymentSettings";
import { getPrinterSettings, printerFor } from "@/lib/repo/printerSettings";
import { buildVietQrPayload } from "@/lib/payments/vietqr";
import { orderCode, isDrinkCategory } from "@/lib/repo/orderRules";
import type { Order, OrderLine } from "@/lib/types";

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

async function enqueue(printer: "kitchen" | "receipt" | "bar", payload: unknown): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("print_jobs").insert({
    tenant_id: getActiveTenant(),
    printer,
    payload,
  });
  return !error;
}

/**
 * Which station makes this line. Drinks go to the bar's printer only when a
 * bar printer is actually enabled — otherwise everything prints at the
 * kitchen, which is every restaurant until the day it isn't.
 */
function ticketStation(menuItemId: string): "kitchen" | "bar" {
  const bar = printerFor(getPrinterSettings(), "bar");
  if (!bar?.enabled || !bar.host) return "kitchen";
  if (menuItemId.startsWith("adhoc:")) return "kitchen";
  const category = getMenuItems(false).find((m) => m.id === menuItemId)?.category;
  return isDrinkCategory(category) ? "bar" : "kitchen";
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function tableLabel(order: Order): string {
  if (order.customerName) return order.customerName;
  if (!order.tableId) return order.source === "delivery" ? "DELIVERY" : "COUNTER";
  return getCachedTables().find((t) => t.id === order.tableId)?.tableNumber ?? "?";
}

/** The round that was just sent — only those lines, so a second round is a second ticket. */
export function kitchenTicketPayload(order: Order, lines: OrderLine[], voided = false) {
  const menu = getMenuItems(false);
  const nameOf = (id: string) =>
    id.startsWith("adhoc:") ? id.slice(6) : (menu.find((m) => m.id === id)?.name.en ?? id);

  return {
    void: voided || undefined,
    table: tableLabel(order),
    code: orderCode(order.id),
    time: hhmm(new Date().toISOString()),
    placedBy: order.placedBy ?? "QR — guest ordered",
    notes: voided ? [] : [order.orderNote, order.guestNote].filter(Boolean),
    lines: lines.map((l) => ({
      qty: l.qty,
      name: nameOf(l.menuItemId),
      detail: (l.choices ?? []).map((c) => c.label.en).join(", ") || undefined,
      note: l.note,
    })),
  };
}

/**
 * One send can be two tickets: the pass gets the food, the bar gets the
 * drinks, each ticket naming only its own station's work. Returns false if
 * ANY ticket failed to queue, because "partly printed" needs the same rescue
 * (the on-screen fallback) as "not printed".
 */
async function enqueueByStation(order: Order, lines: OrderLine[], voided: boolean): Promise<boolean> {
  const byStation = new Map<"kitchen" | "bar", OrderLine[]>();
  for (const line of lines) {
    const station = ticketStation(line.menuItemId);
    byStation.set(station, [...(byStation.get(station) ?? []), line]);
  }
  const results = await Promise.all(
    [...byStation.entries()].map(([station, stationLines]) =>
      enqueue(station, kitchenTicketPayload(order, stationLines, voided))
    )
  );
  return results.every(Boolean);
}

export async function printKitchenTicket(order: Order, lineIds: string[]): Promise<boolean> {
  const lines = order.lines.filter((l) => lineIds.includes(l.id) && l.status !== "cancelled");
  if (lines.length === 0) return true;
  return enqueueByStation(order, lines, false);
}

/**
 * The HỦY ticket. Cancelling a line the kitchen already has does not
 * un-print the first ticket — someone is cooking off that paper. The void
 * ticket is how the pass learns to stop, and it goes to whichever station
 * got the original.
 */
export async function printVoidTicket(order: Order, line: OrderLine): Promise<boolean> {
  return enqueueByStation(order, [line], true);
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
export async function printTest(printer: "kitchen" | "receipt" | "bar"): Promise<boolean> {
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (printer === "kitchen" || printer === "bar") {
    return enqueue(printer, {
      table: "TEST",
      code: "APP",
      time: now,
      placedBy: "Test from Settings",
      notes: ["IF YOU CAN READ THIS, PRINTING WORKS"],
      lines: [
        { qty: 1, name: "Test ticket - Phieu thu" },
        // Real diacritics on purpose: with Vietnamese (CP1258) on, this line
        // is the proof it works; on ASCII it prints "Pho bo - An o day".
        { qty: 1, name: "Phở bò — Ăn ở đây", detail: "kiểm tra tiếng Việt" },
      ],
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

/** The queue's recent tail — what happened to the last few tickets. */
export async function recentPrintJobs(limit = 8): Promise<PrintJobRow[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("print_jobs")
    .select("id, printer, status, error, created_at")
    .eq("tenant_id", getActiveTenant())
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as PrintJobRow[] | null) ?? [];
}

/**
 * The bridge's pulse, written by the bridge every 15 seconds.
 *
 * This exists so a waiter hears "tickets will not print" BEFORE tapping
 * Send, not from the kitchen ten minutes later. Null means no bridge has
 * ever run for this branch; a seenAt older than a minute means it is down
 * right now. Errors count as "unknown", not "offline" — a phone in a wifi
 * dead spot must not cry wolf about the bridge.
 */
export async function bridgeSeenAt(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("print_bridge_status")
    .select("seen_at")
    .eq("tenant_id", getActiveTenant())
    .maybeSingle();
  if (error) return null;
  return (data as { seen_at: string } | null)?.seen_at ?? null;
}

export function bridgeLooksDown(seenAt: string | null, now = Date.now()): boolean {
  if (!seenAt) return false; // never seen — probably never set up; don't nag every send
  return now - new Date(seenAt).getTime() > 60_000;
}
