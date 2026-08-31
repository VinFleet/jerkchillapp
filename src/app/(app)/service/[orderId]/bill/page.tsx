"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { getOrder, getPayments, getBill } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getPaymentSettings } from "@/lib/repo/paymentSettings";
import type { Order, MenuItem, Payment } from "@/lib/types";

/**
 * The bill, as a guest receives it.
 *
 * Printed through the browser rather than a receipt driver: any printer the
 * tablet can already see will do, including the A4 one in the office, and
 * nothing has to be installed on a device that gets replaced every year.
 * A thermal printer on the same network prints this fine at 80mm.
 *
 * Deliberately plain. This is the one screen a guest reads, and it is read
 * while they are deciding whether the number is right — so the items, the
 * quantities and the arithmetic are the whole design.
 */

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

const METHOD: Record<string, string> = {
  cash: "Cash · Tiền mặt",
  vietqr: "Transfer · Chuyển khoản",
  card: "Card · Thẻ",
};

function BillContent() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const load = useCallback(() => {
    setOrder(getOrder(orderId) ?? null);
    setMenu(getMenuItems(false));
    setPayments(getPayments(orderId));
  }, [orderId]);

  useEffect(() => load(), [load]);

  const tableId = order?.tableId ?? null;
  const tableNumber = useMemo(() => {
    if (!tableId) return null;
    return getCachedTables().find((t) => t.id === tableId)?.tableNumber ?? null;
  }, [tableId]);

  if (!order) return <p className="p-8 text-center text-muted">Order not found</p>;

  const bill = getBill(order.id);
  const lines = order.lines.filter((l) => l.status !== "cancelled");
  const bank = getPaymentSettings();

  return (
    <div className="pb-10">
      <div className="print:hidden">
        <BackLink href={`/service/${orderId}`} label="Order" />
      </div>

      {/* 80mm at 203dpi is ~640px; this stays inside that and still reads on A4. */}
      <div className="mx-auto max-w-[420px] px-5 py-6 print:max-w-none print:px-0">
        <header className="text-center mb-5">
          <h1 className="text-xl font-black tracking-tight">JERK &amp; CHILL</h1>
          <p className="text-xs text-muted mt-0.5">Thảo Điền, District 2, HCMC</p>
        </header>

        <div className="text-sm space-y-0.5 mb-4 pb-4 border-b border-dashed border-border">
          <div className="flex justify-between">
            <span className="text-muted">Table · Bàn</span>
            <span className="font-semibold">{tableNumber ?? "Counter · Quầy"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Date · Ngày</span>
            <span className="tabular-nums">
              {new Date(order.placedAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Served by · Phục vụ</span>
            <span>{order.placedBy ?? "QR · Khách tự gọi"}</span>
          </div>
        </div>

        <table className="w-full text-sm">
          <tbody>
            {lines.map((line) => {
              const item = menu.find((m) => m.id === line.menuItemId);
              return (
                <tr key={line.id} className="align-top">
                  <td className="py-1.5 pr-2 tabular-nums w-8">{line.qty}×</td>
                  <td className="py-1.5 pr-2">
                    <span className="block">{item?.name.en ?? "Item"}</span>
                    <span className="block text-xs text-muted">{item?.name.vi}</span>
                    {line.choices?.length ? (
                      <span className="block text-xs text-muted">
                        {line.choices.map((c) => c.label.en).join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                    {vnd(line.unitPriceVnd * line.qty)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 pt-3 border-t border-dashed border-border space-y-1 text-sm">
          {bill && bill.discountVnd > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Subtotal · Tạm tính</span>
                <span className="tabular-nums">{vnd(bill.subtotalVnd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">
                  {order.discount?.label.en ?? "Discount"} · {order.discount?.label.vi ?? "Giảm giá"}
                </span>
                <span className="tabular-nums">−{vnd(bill.discountVnd)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-base font-bold pt-1">
            <span>Total · Tổng cộng</span>
            <span className="tabular-nums">{vnd(bill?.totalVnd ?? 0)}</span>
          </div>

          {payments
            .filter((p) => p.status === "paid")
            .map((p) => (
              <div key={p.id} className="flex justify-between text-muted">
                <span>{METHOD[p.method] ?? p.method}</span>
                <span className="tabular-nums">{vnd(p.amountVnd)}</span>
              </div>
            ))}

          {bill && bill.outstandingVnd > 0 && (
            <div className="flex justify-between font-semibold">
              <span>Still owed · Còn lại</span>
              <span className="tabular-nums">{vnd(bill.outstandingVnd)}</span>
            </div>
          )}
        </div>

        {bank.accountNumber && (
          <div className="mt-4 pt-3 border-t border-dashed border-border text-xs text-muted text-center space-y-0.5">
            <p>Bank transfer · Chuyển khoản</p>
            <p className="font-mono tabular-nums">{bank.accountNumber}</p>
            {bank.accountName && <p>{bank.accountName}</p>}
          </div>
        )}

        <p className="text-center text-xs text-muted mt-5">
          Thank you · Cảm ơn quý khách
        </p>
      </div>

      <div className="print:hidden px-5 max-w-[420px] mx-auto">
        <button
          onClick={() => window.print()}
          className="w-full min-h-[52px] rounded-xl bg-brand text-white font-semibold flex items-center justify-center gap-2"
        >
          <Printer size={18} /> Print bill · In hoá đơn
        </button>
      </div>
    </div>
  );
}

export default function BillPage() {
  return (
    <RoleGate module="orders">
      <BillContent />
    </RoleGate>
  );
}
