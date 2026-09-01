"use client";

import { useCallback, useEffect, useState } from "react";
import { ChefHat, Clock, Ban, LayoutList } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { useSession } from "@/lib/auth/RoleContext";
import { onSyncedDataChanged, syncNow } from "@/lib/sync/engine";
import { getKitchenQueue, setLineStatus, setOrderStatus } from "@/lib/repo/orders";
import { getMenuItems, isSoldOut, setMenuItemSoldOut } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { Bi } from "@/components/Bi";
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

/**
 * Everything still to make, added up across tables.
 *
 * The bar reads this instead of ticket-by-ticket: "4x Ginger Fizz, two of
 * them mocktails" is one shake, not four glances. Grouped by item plus its
 * choices, because a spicy and a non-spicy jerk chicken are different jobs.
 */
function makeList(orders: Order[], nameOf: (id: string) => string) {
  const rows = new Map<string, { key: string; name: string; detail: string; qty: number }>();
  for (const order of orders) {
    for (const line of order.lines) {
      if (!line.sentAt || line.status === "cancelled" || line.status === "ready" || line.status === "served") continue;
      const detail = (line.choices ?? []).map((c) => c.label.en).join(", ");
      const key = `${line.menuItemId}|${detail}`;
      const existing = rows.get(key);
      if (existing) existing.qty += line.qty;
      else rows.set(key, { key, name: nameOf(line.menuItemId), detail, qty: line.qty });
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.qty - a.qty);
}

function KitchenContent() {
  const { session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  // Table id -> the number painted on the table. A chef reading a ticket needs
  // "I4", not a UUID; the id is the join key, never the label.
  const [tableNumbers, setTableNumbers] = useState<Record<string, string>>({});
  const [view, setView] = useState<"tickets" | "items" | "soldout">("tickets");
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
      <PageHeader
        title="Kitchen · Bếp"
        subtitle="Oldest first · Cũ nhất trước"
        action={
          <div className="flex gap-1.5">
            <button
              onClick={() => setView(view === "items" ? "tickets" : "items")}
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                view === "items" ? "border-brand text-brand bg-brand-light" : "border-border"
              }`}
            >
              <LayoutList size={15} /> By item
            </button>
            <button
              onClick={() => setView(view === "soldout" ? "tickets" : "soldout")}
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                view === "soldout" ? "border-danger text-danger bg-danger-tint" : "border-border"
              }`}
            >
              <Ban size={15} /> 86 · Hết
            </button>
          </div>
        }
      />

      {view === "soldout" && (
        <div className="px-4 md:px-8 pb-8 space-y-2">
          <p className="text-sm text-muted">
            Tap what the kitchen has run out of — it leaves the guest menu and greys on the pad at
            once, and comes back by itself tomorrow. · Chạm món đã hết; tự trở lại vào ngày mai.
          </p>
          {menu
            .filter((m) => m.active)
            .map((item) => {
              const out = isSoldOut(item);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMenuItemSoldOut(item.id, !out);
                    load();
                  }}
                  className={`w-full min-h-[56px] rounded-xl border-2 px-4 flex items-center justify-between text-left ${
                    out ? "border-danger bg-danger-tint" : "border-border"
                  }`}
                >
                  <Bi value={item.name} mode="inline" className="text-sm font-medium min-w-0" />
                  <span className={`text-xs font-bold shrink-0 ${out ? "text-danger" : "text-muted"}`}>
                    {out ? "SOLD OUT · HẾT" : "Available · Còn"}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {view === "items" && (
        <div className="px-4 md:px-8 pb-8 space-y-2">
          <p className="text-sm text-muted">
            Everything still to make, added up across tables. Read-only — tick dishes off on their
            tickets. · Tổng món cần làm; đánh dấu trên từng phiếu.
          </p>
          {makeList(orders, (id) => nameFor(id)?.en ?? id.replace("adhoc:", "")).map((row) => (
            <div key={row.key} className="rounded-xl border border-border px-4 py-2.5 flex items-center gap-3">
              <span className="text-2xl font-black tabular-nums w-10 shrink-0">{row.qty}×</span>
              <span className="min-w-0">
                <span className="block font-semibold text-sm">{row.name}</span>
                {row.detail && <span className="block text-xs font-bold text-brand">{row.detail}</span>}
              </span>
            </div>
          ))}
          {makeList(orders, (id) => id).length === 0 && (
            <p className="text-center text-muted py-8 text-sm">Nothing waiting · Không còn món chờ</p>
          )}
        </div>
      )}

      {view === "tickets" && (
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
      )}
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
