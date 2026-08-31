"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Plus, WifiOff, Clock } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { WhoIsWorking } from "@/components/WhoIsWorking";
import { useSession } from "@/lib/auth/RoleContext";
import { onSyncedDataChanged } from "@/lib/sync/engine";
import { getOrders, getOpenOrderForTable, createOrder, getBill } from "@/lib/repo/orders";
import { getCachedTables, cacheTables, tablesAreCached, type CachedTable } from "@/lib/repo/tableCache";
import { getTables } from "@/lib/bookings/repo";
import type { Order } from "@/lib/types";

/**
 * The floor.
 *
 * One screen answering the only question a waiter has walking back from a
 * table: which tables have food coming, which owe money, which are free. A
 * table with an open order shows its total, because "how much is table 6" is
 * asked twenty times a service and should never need a tap.
 *
 * Tapping a free table starts an order and goes straight to the pad — the
 * alternative is a confirm dialog standing between a waiter and the thing
 * they already decided to do.
 */

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

type TableCard = {
  table: CachedTable;
  order: Order | null;
  totalVnd: number;
  outstandingVnd: number;
  awaitingConfirmation: boolean;
};

function ServiceContent() {
  const router = useRouter();
  const { session } = useSession();
  const [tables, setTables] = useState<CachedTable[]>([]);
  const [cards, setCards] = useState<TableCard[]>([]);
  const [counterOrders, setCounterOrders] = useState<Order[]>([]);
  const [live, setLive] = useState(true);
  const [, setTick] = useState(0);

  const build = useCallback((list: CachedTable[]) => {
    setCards(
      list.map((table) => {
        const order = getOpenOrderForTable(table.id) ?? null;
        const bill = order ? getBill(order.id) : null;
        return {
          table,
          order,
          totalVnd: bill?.totalVnd ?? 0,
          outstandingVnd: bill?.outstandingVnd ?? 0,
          awaitingConfirmation: bill?.awaitingConfirmation ?? false,
        };
      })
    );
    setCounterOrders(
      getOrders().filter(
        (o) => o.tableId === null && o.status !== "closed" && o.status !== "cancelled"
      )
    );
  }, []);

  const load = useCallback(() => {
    const cached = getCachedTables();
    setTables(cached);
    build(cached);
  }, [build]);

  useEffect(() => {
    load();
    return onSyncedDataChanged(load);
  }, [load]);

  // Refresh the floor plan from Postgres when we can, and mirror it locally so
  // the next service still works if the router does not. A failure here is not
  // an error state — the cached room is the same room.
  useEffect(() => {
    let cancelled = false;
    getTables()
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map((r) => ({
          id: r.id,
          tableNumber: r.table_number,
          seats: r.seats,
        }));
        cacheTables(mapped);
        setLive(true);
        load();
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Ticket ages climb on their own; a waiter should not have to refresh to see
  // that a table has been waiting.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const open = (card: TableCard) => {
    if (card.order) {
      router.push(`/service/${card.order.id}`);
      return;
    }
    const created = createOrder({
      tableId: card.table.id,
      source: "waiter",
      channel: "dine_in",
      placedBy: session?.name ?? null,
    });
    router.push(`/service/${created.id}`);
  };

  const startCounterOrder = () => {
    const created = createOrder({
      tableId: null,
      source: "counter",
      channel: "dine_in",
      placedBy: session?.name ?? null,
    });
    router.push(`/service/${created.id}`);
  };

  const openCount = cards.filter((c) => c.order).length;

  return (
    <>
      <PageHeader
        title="Service"
        subtitle={`Phục vụ · ${openCount} of ${tables.length} tables open · ${openCount} bàn đang mở`}
        action={<WhoIsWorking compact />}
      />

      <div className="px-4 md:px-8 pb-28 space-y-5">
        {!live && tablesAreCached() && (
          <p className="flex items-center gap-2 text-sm text-muted border border-border rounded-xl px-3 py-2">
            <WifiOff size={16} className="shrink-0" />
            <span>
              Showing the saved floor plan — orders still work
              <br />
              <span className="opacity-80">Đang dùng sơ đồ bàn đã lưu — vẫn gọi món được</span>
            </span>
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((card) => {
            const busy = Boolean(card.order);
            const owes = card.outstandingVnd > 0;
            return (
              <button
                key={card.table.id}
                onClick={() => open(card)}
                className={`min-h-[104px] rounded-2xl border p-3 text-left flex flex-col justify-between transition active:scale-[0.98] ${
                  busy
                    ? "border-brand bg-brand-light"
                    : "border-border hover:border-brand/40"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold">{card.table.tableNumber}</span>
                  <span className="text-xs text-muted">
                    {card.table.seats} <span className="opacity-70">seats · chỗ</span>
                  </span>
                </div>

                {busy && card.order ? (
                  <div className="space-y-0.5">
                    <div className="font-semibold tabular-nums">{vnd(card.totalVnd)}</div>
                    <div className="text-xs flex items-center gap-1 text-muted">
                      <Clock size={12} className="shrink-0" />
                      {minutesSince(card.order.placedAt)}m
                      {card.awaitingConfirmation && (
                        <span className="text-amber-600 font-medium ml-1">
                          · awaiting payment
                        </span>
                      )}
                      {!card.awaitingConfirmation && !owes && card.totalVnd > 0 && (
                        <span className="text-green-700 font-medium ml-1">· paid</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted flex items-center gap-1">
                    <Plus size={14} className="shrink-0" />
                    Start order <span className="opacity-70">· Gọi món</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">
            Counter &amp; takeaway <span className="opacity-70">· Quầy &amp; mang đi</span>
          </h2>
          {counterOrders.map((o) => {
            const bill = getBill(o.id);
            return (
              <button
                key={o.id}
                onClick={() => router.push(`/service/${o.id}`)}
                className="w-full min-h-[60px] rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3 text-left active:scale-[0.99]"
              >
                <span className="flex items-center gap-2">
                  <Receipt size={18} className="text-muted shrink-0" />
                  <span>
                    <span className="font-medium">{o.lines.length} items</span>
                    <span className="text-muted text-sm"> · {minutesSince(o.placedAt)}m</span>
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{vnd(bill?.totalVnd ?? 0)}</span>
              </button>
            );
          })}
          <button
            onClick={startCounterOrder}
            className="w-full min-h-[60px] rounded-xl border border-dashed border-border px-4 py-3 flex items-center justify-center gap-2 text-muted active:scale-[0.99]"
          >
            <Plus size={18} />
            New counter order <span className="opacity-70">· Đơn tại quầy</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default function ServicePage() {
  return (
    <RoleGate module="orders">
      <ServiceContent />
    </RoleGate>
  );
}
