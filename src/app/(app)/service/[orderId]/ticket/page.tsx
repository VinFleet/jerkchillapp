"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { getOrder } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { orderCode } from "@/lib/repo/orderRules";
import type { Order, MenuItem } from "@/lib/types";

/**
 * The kitchen ticket — what gets printed and clipped to the pass.
 *
 * Nothing about money is on it. A chef needs the table, the time, the items,
 * and above all the things that change how a dish is cooked, so prices,
 * discounts and payment are all deliberately absent: they are noise on a
 * ticket read at a glance over a hot pass.
 *
 * Set large and high-contrast for the same reason.
 */

function TicketContent() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);

  const load = useCallback(() => {
    setOrder(getOrder(orderId) ?? null);
    setMenu(getMenuItems(false));
  }, [orderId]);

  useEffect(() => load(), [load]);

  const tableId = order?.tableId ?? null;
  const tableNumber = useMemo(
    () => (tableId ? (getCachedTables().find((t) => t.id === tableId)?.tableNumber ?? null) : null),
    [tableId]
  );

  if (!order) return <p className="p-8 text-center text-muted">Order not found</p>;

  const lines = order.lines.filter((l) => l.status !== "cancelled");

  const nameFor = (menuItemId: string) => {
    if (menuItemId.startsWith("adhoc:")) return menuItemId.slice("adhoc:".length);
    return menu.find((m) => m.id === menuItemId)?.name.en ?? "Item";
  };
  const viFor = (menuItemId: string) =>
    menuItemId.startsWith("adhoc:") ? "" : (menu.find((m) => m.id === menuItemId)?.name.vi ?? "");

  return (
    <div className="pb-10">
      <div className="print:hidden">
        <BackLink href={`/service/${orderId}/review`} label="Order" />
      </div>

      <div className="mx-auto max-w-[420px] px-5 py-5 print:max-w-none print:px-0">
        <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2 mb-3">
          <span className="text-3xl font-black">{tableNumber ?? "COUNTER"}</span>
          <span className="text-right">
            <span className="block font-mono font-bold">{orderCode(order.id)}</span>
            <span className="block text-xs">
              {new Date(order.placedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </span>
        </div>

        <p className="text-sm mb-3">
          {order.placedBy ?? "QR — guest ordered · Khách tự gọi"}
        </p>

        {/* Above the items, not below. This is the part that changes how
            something is cooked, and a ticket is read top-down. */}
        {(order.orderNote || order.guestNote) && (
          <div className="border-2 border-foreground rounded p-2 mb-3 text-base font-bold">
            {order.orderNote && <p>⚠ {order.orderNote}</p>}
            {order.guestNote && <p>⚠ {order.guestNote}</p>}
          </div>
        )}

        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.id} className="flex gap-3 border-b border-dashed border-foreground pb-2">
              <span className="text-2xl font-black tabular-nums w-10 shrink-0">{line.qty}×</span>
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-tight">
                  {nameFor(line.menuItemId)}
                </span>
                {viFor(line.menuItemId) && (
                  <span className="block text-sm">{viFor(line.menuItemId)}</span>
                )}
                {line.choices?.length ? (
                  <span className="block text-base font-bold mt-0.5">
                    {line.choices.map((c) => `${c.label.en} / ${c.label.vi}`).join(" · ")}
                  </span>
                ) : null}
                {line.note && <span className="block text-base font-bold mt-0.5">→ {line.note}</span>}
                {!line.sentAt && <span className="block text-sm">(not sent yet)</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="print:hidden px-5 max-w-[420px] mx-auto mt-4">
        <button
          onClick={() => window.print()}
          className="w-full min-h-[52px] rounded-xl bg-brand text-white font-semibold flex items-center justify-center gap-2"
        >
          <Printer size={18} /> Print ticket · In phiếu bếp
        </button>
      </div>
    </div>
  );
}

export default function TicketPage() {
  return (
    <RoleGate module="orders">
      <TicketContent />
    </RoleGate>
  );
}
