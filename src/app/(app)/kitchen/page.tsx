"use client";

import { useCallback, useEffect, useState } from "react";
import { ChefHat, Ban, LayoutList } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { useSession } from "@/lib/auth/RoleContext";
import { onSyncedDataChanged, syncNow } from "@/lib/sync/engine";
import { getKitchenQueue, setLinesStatus } from "@/lib/repo/orders";
import { orderCode } from "@/lib/repo/orderRules";
import { getMenuItems, isSoldOut, setMenuItemSoldOut } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { Bi } from "@/components/Bi";
import type { Order, MenuItem, OrderLine } from "@/lib/types";

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
  const [station, setStation] = useState<"all" | "food" | "drinks">("all");
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

  /**
   * The board: each ticket sorted into NEW / PREPARING / READY by its own
   * lines, seen through the station filter — the bar's board only counts
   * drinks, so a table whose food is cooking but whose cocktails are
   * untouched is NEW at the bar and PREPARING at the pass. Both are true.
   */
  const DRINK_CATEGORIES = new Set(["beverage", "cocktail"]);
  const inStation = (line: OrderLine) => {
    if (station === "all") return true;
    const cat = menu.find((m) => m.id === line.menuItemId)?.category;
    const isDrink = cat ? DRINK_CATEGORIES.has(cat) : false;
    return station === "drinks" ? isDrink : !isDrink;
  };

  const board = orders
    .map((order) => {
      const lines = order.lines.filter(
        (l) => l.sentAt && l.status !== "cancelled" && l.status !== "served" && inStation(l)
      );
      if (lines.length === 0) return null;
      const stage: "new" | "preparing" | "ready" = lines.every((l) => l.status === "ready")
        ? "ready"
        : lines.some((l) => l.status === "preparing" || l.status === "ready")
          ? "preparing"
          : "new";
      return { order, lines, stage, age: minutesSince(order.placedAt) };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const boardEmpty = board.length === 0;

  const advance = (orderId: string, lineIds: string[], to: "preparing" | "ready" | "served") => {
    setLinesStatus(orderId, lineIds, to);
    load();
  };


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
          {/* Station chips: the bar and the pass read different halves of the
              same board, and neither wants to scan past the other's tickets. */}
          <div className="flex gap-2 mb-3">
            {(
              [
                ["all", "All · Tất cả"],
                ["food", "Food · Món ăn"],
                ["drinks", "Drinks · Đồ uống"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStation(key)}
                className={`min-h-[44px] px-4 rounded-xl border text-sm font-semibold ${
                  station === key ? "border-brand text-brand bg-brand-light" : "border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {boardEmpty ? (
            <div className="text-center py-16">
              <ChefHat size={40} className="text-muted mx-auto mb-3" />
              <p className="font-semibold">Nothing waiting</p>
              <p className="text-sm text-muted">Không có đơn nào</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3 items-start">
              {(
                [
                  ["new", "NEW · MỚI", "danger"],
                  ["preparing", "PREPARING · ĐANG LÀM", "warning"],
                  ["ready", "READY · XONG", "success"],
                ] as const
              ).map(([stage, title, tone]) => {
                const cards = board.filter((c) => c.stage === stage);
                return (
                  <section key={stage} className="rounded-2xl border border-border bg-background/60 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-black tracking-wide">{title}</h2>
                      <span
                        className={`min-w-[26px] h-[26px] px-1.5 rounded-lg grid place-items-center text-sm font-black text-white ${
                          tone === "danger"
                            ? "bg-danger"
                            : tone === "warning"
                              ? "bg-warning"
                              : "bg-success"
                        }`}
                      >
                        {cards.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {cards.map(({ order, lines: cardLines, age }) => {
                        const late = age >= LATE_AFTER_MINUTES;
                        return (
                          <article
                            key={order.id}
                            className={`rounded-xl bg-surface border border-border overflow-hidden border-l-4 ${
                              stage === "new"
                                ? "border-l-danger"
                                : stage === "preparing"
                                  ? "border-l-warning"
                                  : "border-l-success"
                            }`}
                          >
                            <div className="px-3 pt-2.5 flex items-center gap-2">
                              <span className="font-black">#{orderCode(order.id)}</span>
                              <span className="text-xs font-semibold bg-background border border-border rounded-lg px-2 py-1">
                                {order.tableId
                                  ? (tableNumbers[order.tableId] ?? "?")
                                  : (order.customerName ?? "Counter · Quầy")}
                              </span>
                              <span
                                className={`ml-auto text-xs font-black rounded-lg px-2 py-1 text-white ${
                                  late ? "bg-danger animate-pulse" : age >= 8 ? "bg-warning" : "bg-brand"
                                }`}
                              >
                                {age} min
                              </span>
                            </div>

                            {(order.orderNote || order.guestNote) && (
                              <p className="mx-3 mt-2 text-xs font-bold bg-warning-tint text-warning rounded-lg px-2 py-1.5">
                                {[order.orderNote, order.guestNote].filter(Boolean).join(" · ")}
                              </p>
                            )}

                            <ul className="px-3 py-2 space-y-1.5">
                              {cardLines.map((line) => (
                                <li key={line.id} className="leading-tight">
                                  <span className="font-bold">
                                    {line.qty} × {nameFor(line.menuItemId)?.en ?? line.menuItemId.replace("adhoc:", "")}
                                  </span>
                                  {line.choices?.length ? (
                                    <span className="block text-xs font-bold text-brand">
                                      {line.choices.map((c) => `${c.label.en} · ${c.label.vi}`).join(" — ")}
                                    </span>
                                  ) : null}
                                  {line.note && (
                                    <span className="block text-xs text-warning font-semibold">{line.note}</span>
                                  )}
                                </li>
                              ))}
                            </ul>

                            <div className="px-3 pb-3 flex items-center gap-2">
                              <span className="text-xs text-muted mr-auto">
                                {order.source === "qr"
                                  ? "QR · Khách tự gọi"
                                  : order.source === "delivery"
                                    ? "Delivery · Giao đi"
                                    : order.tableId
                                      ? "Dine in · Tại bàn"
                                      : "Counter · Quầy"}
                              </span>
                              {/* Two ways forward, not a forced march: the
                                  next step, and the skip. A chef who plated
                                  straight off the burner marks Ready without
                                  ever having tapped Start, and a dish handed
                                  across the pass goes straight to Done. */}
                              {stage === "new" && (
                                <>
                                  <button
                                    onClick={() => advance(order.id, cardLines.map((l) => l.id), "preparing")}
                                    className="min-h-[44px] px-4 rounded-xl font-bold text-sm text-white bg-foreground active:scale-[0.97]"
                                  >
                                    Start · Làm
                                  </button>
                                  <button
                                    onClick={() => advance(order.id, cardLines.map((l) => l.id), "ready")}
                                    className="min-h-[44px] px-4 rounded-xl font-bold text-sm border-2 border-success text-success active:scale-[0.97]"
                                  >
                                    Ready · Xong
                                  </button>
                                </>
                              )}
                              {stage === "preparing" && (
                                <>
                                  <button
                                    onClick={() => advance(order.id, cardLines.map((l) => l.id), "ready")}
                                    className="min-h-[44px] px-4 rounded-xl font-bold text-sm text-white bg-foreground active:scale-[0.97]"
                                  >
                                    Ready · Xong
                                  </button>
                                  <button
                                    onClick={() => advance(order.id, cardLines.map((l) => l.id), "served")}
                                    className="min-h-[44px] px-4 rounded-xl font-bold text-sm border-2 border-success text-success active:scale-[0.97]"
                                  >
                                    Done · Hoàn thành
                                  </button>
                                </>
                              )}
                              {stage === "ready" && (
                                <button
                                  onClick={() => advance(order.id, cardLines.map((l) => l.id), "served")}
                                  className="min-h-[44px] px-5 rounded-xl font-bold text-sm text-white bg-success active:scale-[0.97]"
                                >
                                  Done · Hoàn thành
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                      {cards.length === 0 && (
                        <p className="text-center text-xs text-muted py-6">— · Trống</p>
                      )}
                    </div>
                  </section>
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
