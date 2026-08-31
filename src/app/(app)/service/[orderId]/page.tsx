"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Banknote, QrCode, CreditCard, Check, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { Bi } from "@/components/Bi";
import { useSession } from "@/lib/auth/RoleContext";
import { canTakePayment } from "@/lib/auth/permissions";
import { onSyncedDataChanged } from "@/lib/sync/engine";
import {
  getOrder,
  getPayments,
  getBill,
  addLine,
  setLineStatus,
  setLineQty,
  takePayment,
  closeOrder,
  confirmPaymentByReference,
} from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getPaymentSettings, vietQrConfigured } from "@/lib/repo/paymentSettings";
import { buildVietQrPayload } from "@/lib/payments/vietqr";
import type { Order, MenuItem, Payment, PaymentMethod } from "@/lib/types";

/**
 * The pad and the bill, on one screen.
 *
 * They are the same screen because they are the same conversation: a guest
 * adds a drink while asking for the bill, and a till that makes you leave the
 * order to see the total gets the total wrong. Adding is one tap per item —
 * quantity is adjusted after, not chosen from a picker first, because the
 * common case is one of a thing.
 *
 * Cancelling a line does not delete it. A line the kitchen has already cooked
 * is a fact about the evening even when it comes off the bill, and the
 * variance report needs it.
 */

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

const METHOD_LABEL: Record<PaymentMethod, { en: string; vi: string }> = {
  cash: { en: "Cash", vi: "Tiền mặt" },
  vietqr: { en: "Bank transfer", vi: "Chuyển khoản" },
  card: { en: "Card", vi: "Thẻ" },
};

function OrderContent() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const { session } = useSession();
  const mayTakeMoney = session ? canTakePayment(session.role) : false;

  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    setOrder(getOrder(orderId) ?? null);
    setPayments(getPayments(orderId));
    setMenu(getMenuItems());
  }, [orderId]);

  useEffect(() => {
    load();
    return onSyncedDataChanged(load);
  }, [load]);

  // While a transfer is outstanding, ask whether it has landed.
  //
  // The guest is standing at the table for this, so it polls rather than
  // waiting for the next sync — but it stops the moment nothing is pending,
  // because an idle till should not be talking to the server every few seconds
  // all evening. Confirming writes locally and syncs out from there, which is
  // what keeps the money path on the same local-first footing as everything else.
  const pendingRefs = payments
    .filter((p) => p.status === "pending" && p.method === "vietqr")
    .map((p) => p.reference)
    .join(",");

  useEffect(() => {
    if (!pendingRefs) return;
    const refs = pendingRefs.split(",");
    let stop = false;

    const check = async () => {
      for (const reference of refs) {
        try {
          const res = await fetch(
            `/api/payments/status?reference=${encodeURIComponent(reference)}`
          );
          if (!res.ok) continue;
          const body = (await res.json()) as {
            status?: string;
            providerRef?: string;
            provider?: string;
          };
          if (body.status === "paid" && body.providerRef) {
            confirmPaymentByReference(reference, body.providerRef, body.provider ?? "bank");
            if (!stop) load();
          }
        } catch {
          // Offline, or the server is down. The waiter can still take cash;
          // silence here is better than an error banner over a working till.
        }
      }
    };

    void check();
    const timer = setInterval(check, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [pendingRefs, load]);

  const bill = order ? getBill(order.id) : null;

  const tableId = order?.tableId ?? null;
  const tableNumber = useMemo(() => {
    if (!tableId) return null;
    return getCachedTables().find((t) => t.id === tableId)?.tableNumber ?? null;
  }, [tableId]);

  const categories = useMemo(() => {
    const seen = new Set(menu.map((m) => m.category));
    return ["all", ...Array.from(seen)];
  }, [menu]);

  const shown = useMemo(
    () =>
      menu.filter(
        (m) =>
          (category === "all" || m.category === category) &&
          m.pricesVnd[order?.channel ?? "dine_in"] !== null &&
          m.pricesVnd[order?.channel ?? "dine_in"] !== undefined
      ),
    [menu, category, order?.channel]
  );

  if (!order) {
    return (
      <div className="p-8 text-center text-muted">
        <p>Order not found</p>
        <p className="text-sm opacity-80">Không tìm thấy đơn</p>
      </div>
    );
  }

  const liveLines = order.lines.filter((l) => l.status !== "cancelled");

  const add = (item: MenuItem) => {
    addLine(order.id, item.id, 1);
    load();
  };

  const bump = (lineId: string, delta: number) => {
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) return;
    // Below one, setLineQty cancels the line — which is what "minus" on a
    // single item means, and saves a second tap on the bin.
    setLineQty(order.id, line.id, line.qty + delta);
    load();
  };

  const cancelLine = (lineId: string) => {
    setLineStatus(order.id, lineId, "cancelled");
    load();
  };

  const pay = (method: PaymentMethod) => {
    if (!bill || bill.outstandingVnd <= 0) return;
    const payment = takePayment({
      orderId: order.id,
      method,
      amountVnd: bill.outstandingVnd,
      takenBy: session?.name ?? null,
    });

    if (method === "vietqr") {
      const s = getPaymentSettings();
      try {
        setQrPayload(
          buildVietQrPayload({
            bankBin: s.bankBin,
            accountNumber: s.accountNumber,
            amountVnd: payment.amountVnd,
            reference: payment.reference,
          })
        );
        setProblem(null);
      } catch (err) {
        setProblem(err instanceof Error ? err.message : "Could not build the QR");
      }
    }
    load();
  };

  const finish = () => {
    const verdict = closeOrder(order.id);
    if (verdict.ok) {
      router.push("/service");
      return;
    }
    setProblem(
      verdict.reason === "awaiting_payment"
        ? "A payment is still unconfirmed — wait for it to land, or mark it failed. Thanh toán chưa xác nhận."
        : verdict.reason === "unpaid"
          ? "This bill is not fully paid. Hoá đơn chưa thanh toán đủ."
          : "This order has nothing on it. Đơn này chưa có món."
    );
  };

  return (
    <>
      <BackLink href="/service" label="Service" />
      <PageHeader
        title={tableNumber ? `Table ${tableNumber}` : "Counter order"}
        subtitle={
          tableNumber
            ? `Bàn ${tableNumber} · ${liveLines.length} items · ${order.placedBy ?? "—"}`
            : `Đơn tại quầy · ${liveLines.length} items`
        }
      />

      {/* Clears the money bar and the mobile nav beneath it. The bar grows a
          row when part-paid, so this is generous on purpose — menu items
          hidden behind it are items nobody can order. */}
      <div className="px-4 md:px-8 pb-64 md:pb-48 space-y-6">
        {problem && (
          <p className="flex items-start gap-2 text-sm rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {problem}
          </p>
        )}

        {/* The bill so far */}
        {liveLines.length > 0 && (
          <div className="rounded-2xl border border-[var(--line)] divide-y divide-[var(--line)]">
            {liveLines.map((line) => {
              const item = menu.find((m) => m.id === line.menuItemId);
              return (
                <div key={line.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    {item ? (
                      <Bi value={item.name} mode="inline" className="text-sm font-medium" />
                    ) : (
                      <span className="text-sm text-muted">Removed item</span>
                    )}
                    {line.note && <p className="text-xs text-muted mt-0.5">{line.note}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => bump(line.id, -1)}
                      aria-label="One fewer"
                      className="w-10 h-10 rounded-lg border border-[var(--line)] grid place-items-center active:scale-95"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-7 text-center tabular-nums font-semibold">{line.qty}</span>
                    <button
                      onClick={() => bump(line.id, 1)}
                      aria-label="One more"
                      className="w-10 h-10 rounded-lg border border-[var(--line)] grid place-items-center active:scale-95"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="w-24 text-right tabular-nums text-sm font-semibold shrink-0">
                    {vnd(line.unitPriceVnd * line.qty)}
                  </span>
                  <button
                    onClick={() => cancelLine(line.id)}
                    aria-label="Take off the bill"
                    className="w-10 h-10 rounded-lg grid place-items-center text-muted active:scale-95"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Menu */}
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 min-h-[40px] px-4 rounded-full border text-sm capitalize ${
                  category === c
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[var(--line)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {shown.map((item) => (
              <button
                key={item.id}
                onClick={() => add(item)}
                className="min-h-[72px] rounded-xl border border-[var(--line)] p-3 text-left active:scale-[0.98] hover:border-[var(--brand)]/40"
              >
                <Bi value={item.name} className="text-sm font-medium leading-tight" />
                <span className="text-xs text-muted tabular-nums mt-1 block">
                  {vnd(item.pricesVnd[order.channel] ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Payments taken */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-muted">
              Payments <span className="opacity-70">· Thanh toán</span>
            </h2>
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                <span>
                  {METHOD_LABEL[p.method].en}
                  <span className="text-muted"> · {METHOD_LABEL[p.method].vi}</span>
                  <span className="block text-xs text-muted font-mono">{p.reference}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="tabular-nums font-semibold block">{vnd(p.amountVnd)}</span>
                  <span
                    className={`text-xs ${
                      p.status === "paid"
                        ? "text-green-700"
                        : p.status === "pending"
                          ? "text-amber-600"
                          : "text-muted"
                    }`}
                  >
                    {p.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {qrPayload && (
          <div className="rounded-2xl border border-[var(--line)] p-4 space-y-2">
            <p className="text-sm font-semibold">
              Show this to the guest <span className="text-muted">· Đưa khách quét</span>
            </p>
            <p className="text-xs text-muted break-all font-mono">{qrPayload}</p>
            <p className="text-xs text-muted">
              Waiting for the transfer to land · Đang chờ chuyển khoản — this confirms itself, no
              need to watch it.
            </p>
          </div>
        )}
      </div>

      {/* The money bar — always in reach, never scrolled past */}
      {bill && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 border-t border-[var(--line)] bg-[var(--bg)] px-4 md:px-8 py-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">
              Total <span className="opacity-70">· Tổng</span>
            </span>
            <span className="text-xl font-bold tabular-nums">{vnd(bill.totalVnd)}</span>
          </div>
          {bill.settledVnd > 0 && bill.outstandingVnd > 0 && (
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">
                Still owed <span className="opacity-70">· Còn lại</span>
              </span>
              <span className="font-semibold tabular-nums">{vnd(bill.outstandingVnd)}</span>
            </div>
          )}

          {mayTakeMoney && (
            <div className="flex gap-2">
              {bill.outstandingVnd > 0 ? (
                <>
                  <button
                    onClick={() => pay("cash")}
                    className="flex-1 min-h-[52px] rounded-xl bg-[var(--brand)] text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Banknote size={18} /> Cash
                  </button>
                  <button
                    onClick={() => pay("vietqr")}
                    disabled={!vietQrConfigured()}
                    title={vietQrConfigured() ? undefined : "Add the bank account in Settings first"}
                    className="flex-1 min-h-[52px] rounded-xl border border-[var(--line)] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
                  >
                    <QrCode size={18} /> Transfer
                  </button>
                  <button
                    onClick={() => pay("card")}
                    className="flex-1 min-h-[52px] rounded-xl border border-[var(--line)] font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <CreditCard size={18} /> Card
                  </button>
                </>
              ) : (
                <button
                  onClick={finish}
                  className="flex-1 min-h-[52px] rounded-xl bg-green-700 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Check size={18} /> Close table · Đóng bàn
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function OrderPage() {
  return (
    <RoleGate module="orders">
      <OrderContent />
    </RoleGate>
  );
}
