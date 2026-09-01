"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, RotateCcw } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import { canTakePayment } from "@/lib/auth/permissions";
import { getClosedOrdersForDate, getPayments, refundPayment, getBill } from "@/lib/repo/orders";
import { getCachedTables } from "@/lib/repo/tableCache";
import { orderCode } from "@/lib/repo/orderRules";
import { todayIso } from "@/lib/storage";
import type { Order, Payment } from "@/lib/types";

/**
 * The day's finished orders.
 *
 * Three questions get asked after a table has left: "what did they have",
 * "print me that bill again", and — rarely, and always urgently — "give them
 * their money back". All three used to be unanswerable, because closed orders
 * simply vanished from every screen.
 *
 * Refunds flip the payment's status rather than deleting anything, take a
 * second tap to confirm, and are stamped with who did it. Cash-up subtracts
 * them, so the drawer count still explains itself.
 */

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

function shiftDate(date: string, byDays: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + byDays);
  return d.toISOString().slice(0, 10);
}

function HistoryContent() {
  const { session } = useSession();
  const mayRefund = session ? canTakePayment(session.role) : false;

  const [date, setDate] = useState(todayIso());
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    const list = getClosedOrdersForDate(date);
    setOrders(list);
    setPayments(Object.fromEntries(list.map((o) => [o.id, getPayments(o.id)])));
  }, [date]);

  useEffect(() => load(), [load]);

  const tables = useMemo(() => getCachedTables(), []);
  const labelFor = (o: Order) =>
    o.customerName ||
    (o.tableId
      ? `Table ${tables.find((t) => t.id === o.tableId)?.tableNumber ?? "?"}`
      : o.source === "delivery"
        ? "Delivery"
        : "Counter");

  const dayTotal = orders
    .filter((o) => o.status === "closed")
    .reduce((sum, o) => sum + (getBill(o.id)?.totalVnd ?? 0), 0);

  return (
    <div className="pb-10">
      <BackLink href="/service" label="Service" />
      <PageHeader
        title="Closed orders · Đơn Đã Đóng"
        subtitle={`${orders.length} orders · ${vnd(dayTotal)}`}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Previous day"
              className="w-11 h-11 rounded-lg border border-border grid place-items-center"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold tabular-nums px-1">{date.slice(5)}</span>
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={date >= todayIso()}
              aria-label="Next day"
              className="w-11 h-11 rounded-lg border border-border grid place-items-center disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-8 space-y-3">
        {orders.length === 0 && (
          <p className="text-center text-muted py-12 text-sm">
            Nothing closed this day · Không có đơn nào
          </p>
        )}

        {orders.map((order) => {
          const bill = getBill(order.id);
          const paid = payments[order.id] ?? [];
          const cancelled = order.status === "cancelled";
          return (
            <div
              key={order.id}
              className={`rounded-2xl border border-border bg-surface p-3 ${cancelled ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold text-sm">
                    {labelFor(order)}{" "}
                    <span className="text-muted font-mono font-normal">{orderCode(order.id)}</span>
                  </span>
                  <span className="block text-xs text-muted">
                    {new Date(order.updatedAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {order.lines.filter((l) => l.status !== "cancelled").length} items
                    {cancelled && <span className="text-danger font-semibold"> · voided · đã huỷ</span>}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-bold tabular-nums">{vnd(bill?.totalVnd ?? 0)}</span>
                  <Link
                    href={`/service/${order.id}/bill`}
                    aria-label="Reprint the bill"
                    className="w-11 h-11 rounded-lg border border-border grid place-items-center"
                  >
                    <Printer size={16} />
                  </Link>
                </span>
              </div>

              {paid.map((p) => (
                <div
                  key={p.id}
                  className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    {p.method}
                    <span className="text-muted font-mono text-xs block truncate">
                      {p.providerRef || p.reference}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={`tabular-nums font-semibold ${p.status === "refunded" ? "line-through text-muted" : ""}`}
                    >
                      {vnd(p.amountVnd)}
                    </span>
                    {p.status === "refunded" && (
                      <span className="text-xs text-danger font-semibold">refunded</span>
                    )}
                    {mayRefund && p.status === "paid" && (
                      confirming === p.id ? (
                        <span className="flex gap-1">
                          <button
                            onClick={() => {
                              refundPayment(p.id, session?.name ?? null);
                              setConfirming(null);
                              load();
                            }}
                            className="min-h-[40px] px-3 rounded-lg bg-danger text-white text-xs font-bold"
                          >
                            Refund {vnd(p.amountVnd)}
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="min-h-[40px] px-2 rounded-lg border border-border text-xs"
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirming(p.id)}
                          aria-label="Refund this payment"
                          className="w-10 h-10 rounded-lg grid place-items-center text-muted"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <RoleGate module="orders">
      <HistoryContent />
    </RoleGate>
  );
}
