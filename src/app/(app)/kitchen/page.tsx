"use client";

import { useCallback, useEffect, useState } from "react";
import { ChefHat, Clock } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { useSession } from "@/lib/auth/RoleContext";
import { onSyncedDataChanged, syncNow } from "@/lib/sync/engine";
import { getKitchenQueue, setLineStatus, setOrderStatus } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
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
  // Table id -> the number painted on the table. A chef reading a ticket needs
  // "I4", not a UUID; the id is the join key, never the label.
  const [tableNumbers, setTableNumbers] = useState<Record<string, string>>({});
  // Re-render on a timer so ticket ages climb without anyone touching the
  // screen — a stale "2 min" on a ticket that has been sitting ten is worse
  // than no age at all.
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    setOrders(getKitchenQueue());
    setMenu(getMenuItems(false));
    setTableNumbers(
      Object.fromEntries(getCachedTables().map((t) => [t.id, t.tableNumber]))
    );
  }, []);

  useEffect(() => {
    load();
    const stop = onSyncedDataChanged(load);
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);

    // Pull faster than the app's one-minute background cycle while this screen
    // is actually up. A QR order is placed by a guest who then just waits, and
    // a minute of a ticket not existing is a minute nobody is cooking it. This
    // is the one screen where that latency is the whole job, and it stops as
    // soon as the pass is closed rather than running all evening everywhere.
    const pull = setInterval(() => void syncNow(), 12_000);
    return () => {
      stop();
      clearInterval(timer);
      clearInterval(pull);
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
              // Sent lines only. A round still being keyed at the table is not the
              // kitchen's business until the waiter says so.
              const open = order.lines.filter((l) => l.sentAt && l.status !== "cancelled");

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-2 p-4 bg-surface ${late ? "border-danger" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-bold text-lg">
                        {order.tableId
                          ? // Falls back to the id only if the floor plan has
                            // not loaded — unreadable, but better than blank.
                            (tableNumbers[order.tableId] ?? order.tableId)
                          : "Counter · Quầy"}
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

                  {/* Both notes, labelled by who said it. For an allergy the
                      difference between "the guest typed this" and "a waiter
                      was told this at the table" is the one that matters. */}
                  {order.orderNote && (
                    <p className="text-sm bg-warning-tint text-warning rounded-xl px-3 py-2 mb-2 font-semibold">
                      <span className="block text-xs font-normal opacity-80">
                        From the table · Từ bàn
                      </span>
                      {order.orderNote}
                    </p>
                  )}
                  {order.guestNote && (
                    <p className="text-sm bg-warning-tint text-warning rounded-xl px-3 py-2 mb-3 font-semibold">
                      <span className="block text-xs font-normal opacity-80">
                        Guest wrote · Khách ghi
                      </span>
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
                            <span className="block font-semibold text-sm">
                              {name?.en ?? line.menuItemId.replace("adhoc:", "")}
                            </span>
                            <span className="block text-xs text-muted">{name?.vi ?? ""}</span>
                            {/* The choice is the cooking instruction — "Spicy",
                                "Mocktail". A pass that hides it cooks the
                                default and finds out at the table. */}
                            {line.choices?.length ? (
                              <span className="block text-xs font-bold text-brand mt-0.5">
                                {line.choices.map((c) => `${c.label.en} · ${c.label.vi}`).join(" — ")}
                              </span>
                            ) : null}
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
