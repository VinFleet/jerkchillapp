"use client";

import { useCallback, useEffect, useState } from "react";
import { ChefHat, Clock } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { useSession } from "@/lib/auth/RoleContext";
import { onSyncedDataChanged } from "@/lib/sync/engine";
import { getKitchenQueue, setLineStatus, setOrderStatus } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import type { Order, MenuItem } from "@/lib/types";

/**
 * The pass.
 *
 * Oldest first — this is a queue, not a feed. A ticket that has been waiting
 * eight minutes should be the one nearest your hand, and the age on every
 * ticket is there so a slow one looks wrong at a glance rather than needing to
 * be worked out.
 *
 * Re-reads on every sync so an order taken on a waiter's phone appears here
 * without anyone refreshing.
 */

/** Minutes after which a ticket reads as late. Roughly a starter's grace. */
const LATE_AFTER_MINUTES = 12;

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function KitchenContent() {
  const { session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  // Re-render on a timer so ticket ages climb without anyone touching the
  // screen — a stale "2 min" on a ticket that has been sitting ten is worse
  // than no age at all.
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    setOrders(getKitchenQueue());
    setMenu(getMenuItems(false));
  }, []);

  useEffect(() => {
    load();
    const stop = onSyncedDataChanged(load);
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [load]);

  if (!session) return null;

  const nameFor = (menuItemId: string) => menu.find((m) => m.id === menuItemId)?.name;

  return (
    <div className="pb-6">
      <PageHeader title="Kitchen · Bếp" subtitle="Oldest first · Cũ nhất trước" />

      <div className="px-4 md:px-8">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat size={40} className="text-muted mx-auto mb-3" />
            <p className="font-semibold">Nothing waiting</p>
            <p className="text-sm text-muted">Không có đơn nào</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => {
              const age = minutesSince(order.placedAt);
              const late = age >= LATE_AFTER_MINUTES;
              const open = order.lines.filter((l) => l.status !== "cancelled");

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-2 p-4 bg-surface ${late ? "border-danger" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-bold text-lg">
                        {order.tableId ?? "Counter · Quầy"}
                      </p>
                      <p className="text-xs text-muted">
                        {order.source === "qr" ? "Ordered by guest · Khách tự gọi" : order.placedBy ?? ""}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
                        late ? "text-danger" : "text-muted"
                      }`}
                    >
                      <Clock size={14} />
                      {age}m
                    </span>
                  </div>

                  {order.guestNote && (
                    <p className="text-sm bg-warning-tint text-warning rounded-xl px-3 py-2 mb-3 font-semibold">
                      {order.guestNote}
                    </p>
                  )}

                  <div className="space-y-2">
                    {open.map((line) => {
                      const name = nameFor(line.menuItemId);
                      const done = line.status === "ready" || line.status === "served";
                      return (
                        <button
                          key={line.id}
                          onClick={() =>
                            setLineStatus(
                              order.id,
                              line.id,
                              line.status === "placed" ? "preparing" : line.status === "preparing" ? "ready" : "served"
                            ) ?? load()
                          }
                          className={`w-full min-h-16 rounded-xl border-2 px-3 py-2 flex items-center gap-3 text-left ${
                            done ? "border-success bg-success-tint" : line.status === "preparing" ? "border-warning bg-warning-tint" : "border-border"
                          }`}
                        >
                          <span className="text-xl font-bold tabular-nums w-8 shrink-0">{line.qty}×</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-sm">{name?.en ?? line.menuItemId}</span>
                            <span className="block text-xs text-muted">{name?.vi ?? ""}</span>
                            {line.note && (
                              <span className="block text-xs text-warning font-semibold mt-0.5">{line.note}</span>
                            )}
                          </span>
                          <span className="text-xs font-bold uppercase shrink-0">
                            {line.status === "placed" ? "Start" : line.status === "preparing" ? "Ready" : "Served"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {open.every((l) => l.status === "ready") && open.length > 0 && (
                    <button
                      onClick={() => {
                        open.forEach((l) => setLineStatus(order.id, l.id, "served"));
                        setOrderStatus(order.id, "served");
                        load();
                      }}
                      className="w-full min-h-12 mt-3 rounded-xl bg-success text-white font-bold text-sm"
                    >
                      All served · Đã phục vụ hết
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  return (
    <RoleGate module="orders">
      <KitchenContent />
    </RoleGate>
  );
}
