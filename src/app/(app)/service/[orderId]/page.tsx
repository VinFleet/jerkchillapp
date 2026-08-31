"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  CreditCard,
  Check,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  AlertCircle,
  LayoutGrid,
  Tag,
  X,
} from "lucide-react";
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
  setDiscount,
} from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getPromotions } from "@/lib/repo/promotions";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getPaymentSettings, vietQrConfigured } from "@/lib/repo/paymentSettings";
import { buildVietQrPayload } from "@/lib/payments/vietqr";
import { linePriceVnd } from "@/lib/repo/orderRules";
import type {
  Order,
  MenuItem,
  MenuOption,
  Payment,
  PaymentMethod,
  Promotion,
  OrderLineChoice,
  MenuChannel,
} from "@/lib/types";

/**
 * The pad and the bill.
 *
 * The menu gets the whole screen, because that is what a waiter is looking at
 * for all but the last ten seconds of a table. The order itself lives in a
 * sheet pulled up from the bottom — reachable with the thumb holding the
 * phone, and out of the way until it is wanted. Putting the lines at the top
 * meant the menu started halfway down the screen and shrank with every round.
 *
 * Items with options ask before they are added. That question is per person,
 * not per table, so it is asked per line rather than remembered.
 */

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

const METHOD_LABEL: Record<PaymentMethod, { en: string; vi: string }> = {
  cash: { en: "Cash", vi: "Tiền mặt" },
  vietqr: { en: "Bank transfer", vi: "Chuyển khoản" },
  card: { en: "Card", vi: "Thẻ" },
};

/**
 * Adding one item — its questions, a note, and how many.
 *
 * A full screen rather than a popover, copied from the till the team already
 * knows. It earns the space: the spice question is asked per person, and a
 * required question that can be dismissed by tapping outside is a question
 * that gets skipped. The amount button stays dead until every required option
 * is answered, so the failure is visible before the plate is cooked.
 */
function AddItemPanel({
  item,
  channel,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  channel: MenuChannel;
  onCancel: () => void;
  onConfirm: (choices: OrderLineChoice[], qty: number, note: string) => void;
}) {
  const options = item.options ?? [];
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const missing = options.filter((o) => o.required && !picked[o.id]);
  const chosen: OrderLineChoice[] = options.flatMap((option) => {
    const choice = option.choices.find((c) => c.id === picked[option.id]);
    return choice
      ? [
          {
            optionId: option.id,
            choiceId: choice.id,
            label: choice.label,
            priceDeltaVnd: choice.priceDeltaVnd,
          },
        ]
      : [];
  });

  const base = item.pricesVnd[channel] ?? 0;
  const each = linePriceVnd(base, chosen);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
        <button
          onClick={onCancel}
          aria-label="Back"
          className="w-11 h-11 rounded-lg grid place-items-center"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-semibold">
          Add item <span className="text-muted font-normal">· Thêm món</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="rounded-2xl border border-border bg-[var(--surface)] p-3 flex items-center gap-3">
          <span className="w-16 h-16 rounded-xl bg-brand-light text-brand grid place-items-center text-xl font-black shrink-0">
            {item.name.en.slice(0, 2).toUpperCase()}
          </span>
          <Bi value={item.name} className="font-bold leading-tight" />
          <span className="ml-auto font-bold tabular-nums shrink-0">{vnd(base)}</span>
        </div>

        {options.map((option: MenuOption) => {
          const unanswered = option.required && !picked[option.id];
          return (
            <div
              key={option.id}
              className={`rounded-2xl border-2 bg-[var(--surface)] overflow-hidden ${
                unanswered ? "border-brand" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                  <Bi value={option.label} mode="inline" />
                  {unanswered && <AlertCircle size={15} className="text-brand shrink-0" />}
                </span>
                <span className="text-sm text-muted shrink-0">
                  {option.required ? "Select 1 · Chọn 1" : "Optional"}
                </span>
              </div>
              {option.choices.map((choice) => {
                const active = picked[option.id] === choice.id;
                return (
                  <button
                    key={choice.id}
                    onClick={() => setPicked((p) => ({ ...p, [option.id]: choice.id }))}
                    className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left border-b border-border last:border-b-0"
                  >
                    <span
                      className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${
                        active ? "border-brand" : "border-border"
                      }`}
                    >
                      {active && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
                    </span>
                    <Bi value={choice.label} mode="inline" className="flex-1 min-w-0" />
                    <span className="text-sm tabular-nums text-muted shrink-0">
                      {choice.priceDeltaVnd === 0
                        ? "0₫"
                        : `${choice.priceDeltaVnd > 0 ? "+" : "−"}${Math.abs(
                            choice.priceDeltaVnd
                          ).toLocaleString("vi-VN")}₫`}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        <div className="space-y-1.5">
          <label className="text-sm text-muted" htmlFor="line-note">
            Note <span className="opacity-70">· Ghi chú</span>
          </label>
          <input
            id="line-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Allergy, no onion… · Dị ứng, không hành…"
            className="w-full min-h-[52px] rounded-xl border border-border bg-[var(--surface)] px-4"
          />
        </div>
      </div>

      <div className="border-t border-border p-3 space-y-3 shrink-0">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="One fewer"
            className="w-12 h-12 rounded-full border border-border grid place-items-center"
          >
            <Minus size={18} />
          </button>
          <span className="text-xl font-bold tabular-nums w-10 text-center">{qty}</span>
          <button
            onClick={() => setQty((q) => q + 1)}
            aria-label="One more"
            className="w-12 h-12 rounded-full border border-border grid place-items-center"
          >
            <Plus size={18} />
          </button>
        </div>
        <button
          onClick={() => onConfirm(chosen, qty, note.trim())}
          disabled={missing.length > 0}
          className="w-full min-h-[56px] rounded-xl bg-brand text-white font-semibold disabled:bg-border disabled:text-muted"
        >
          {missing.length > 0
            ? `Choose ${missing[0].label.en} · Chọn ${missing[0].label.vi}`
            : `Add · Thêm — ${vnd(each * qty)}`}
        </button>
      </div>
    </div>
  );
}

function OrderContent() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const { session } = useSession();
  const mayTakeMoney = session ? canTakePayment(session.role) : false;

  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [asking, setAsking] = useState<MenuItem | null>(null);
  const [showPromotions, setShowPromotions] = useState(false);

  const load = useCallback(() => {
    setOrder(getOrder(orderId) ?? null);
    setPayments(getPayments(orderId));
    setMenu(getMenuItems());
    setPromotions(getPromotions());
  }, [orderId]);

  useEffect(() => {
    load();
    return onSyncedDataChanged(load);
  }, [load]);

  const pendingRefs = payments
    .filter((p) => p.status === "pending" && p.method === "vietqr")
    .map((p) => p.reference)
    .join(",");

  // While a transfer is outstanding, ask whether it has landed. Stops as soon
  // as nothing is pending — an idle till should not poll all evening.
  useEffect(() => {
    if (!pendingRefs) return;
    const refs = pendingRefs.split(",");
    let stop = false;

    const check = async () => {
      for (const reference of refs) {
        try {
          const res = await fetch(`/api/payments/status?reference=${encodeURIComponent(reference)}`);
          if (!res.ok) continue;
          const body = (await res.json()) as { status?: string; providerRef?: string; provider?: string };
          if (body.status === "paid" && body.providerRef) {
            confirmPaymentByReference(reference, body.providerRef, body.provider ?? "bank");
            if (!stop) load();
          }
        } catch {
          // Offline, or the server is down. Cash still works; a banner over a
          // working till would help nobody.
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
          m.pricesVnd[order?.channel ?? "dine_in"] != null
      ),
    [menu, category, order?.channel]
  );

  /** Menu split into its printed sections, so a heading is never a lone card. */
  const grouped = useMemo(() => {
    const sections: { heading: string; items: MenuItem[] }[] = [];
    for (const item of shown) {
      const last = sections[sections.length - 1];
      if (last && last.heading === item.category) last.items.push(item);
      else sections.push({ heading: item.category, items: [item] });
    }
    return sections;
  }, [shown]);

  if (!order) {
    return (
      <div className="p-8 text-center text-muted">
        <p>Order not found</p>
        <p className="text-sm opacity-80">Không tìm thấy đơn</p>
      </div>
    );
  }

  const liveLines = order.lines.filter((l) => l.status !== "cancelled");

  // Everything goes through the panel. Consistency beats a saved tap: a
  // waiter should not have to know which items ask questions and which drop
  // straight onto the bill.
  const add = (item: MenuItem) => setAsking(item);

  const addWithChoices = (
    item: MenuItem,
    choices: OrderLineChoice[],
    qty: number,
    note: string
  ) => {
    addLine(order.id, item.id, qty, note || undefined, choices);
    setAsking(null);
    load();
  };

  const bump = (lineId: string, delta: number) => {
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) return;
    setLineQty(order.id, line.id, line.qty + delta);
    load();
  };

  const cancelLine = (lineId: string) => {
    setLineStatus(order.id, lineId, "cancelled");
    load();
  };

  const applyPromotion = (promotion: Promotion) => {
    setDiscount(order.id, {
      kind: promotion.kind,
      value: promotion.value,
      label: promotion.label,
      promotionId: promotion.id,
      appliedBy: session?.name ?? null,
      appliedAt: new Date().toISOString(),
    });
    setShowPromotions(false);
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
            ? `Bàn ${tableNumber} · ${order.placedBy ?? "Ordered by guest · Khách tự gọi"}`
            : "Đơn tại quầy"
        }
      />

      {problem && (
        <p className="mx-4 md:mx-8 flex items-start gap-2 text-sm rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 mb-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {problem}
        </p>
      )}

      {/* Category rail down the side, menu beside it — the shape of the till
          the team already uses. The rail stays put while the menu scrolls, so
          jumping to Cocktails never means scrolling back up first. */}
      <div className="flex gap-0 pb-56 md:pb-44">
        <nav className="w-[86px] shrink-0 sticky top-0 self-start max-h-[calc(100dvh-13rem)] overflow-y-auto border-r border-border">
          {categories.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`w-full min-h-[76px] px-1 py-3 flex flex-col items-center justify-center gap-1 text-center border-b border-border ${
                  active ? "bg-brand-light text-brand font-semibold" : "text-muted"
                }`}
              >
                <LayoutGrid size={20} className="shrink-0" />
                <span className="text-[11px] leading-tight capitalize">
                  {c === "all" ? "All · Tất cả" : c.replace("_", " ")}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 px-3 py-3">
          {grouped.map(({ heading, items }) => (
            <section key={heading} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-bold capitalize shrink-0">{heading.replace("_", " ")}</h2>
                <span className="flex-1 border-t border-dashed border-border" />
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => add(item)}
                    className="rounded-2xl overflow-hidden border border-border text-left active:scale-[0.98] flex flex-col"
                  >
                    {/* No photography in the menu data yet, so the tile carries
                        the initials rather than an empty grey box. */}
                    <span className="aspect-[4/3] bg-brand-light text-brand/70 grid place-items-center text-2xl font-black">
                      {item.name.en.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="bg-[var(--surface)] py-1.5 text-center font-bold tabular-nums text-sm">
                      {vnd(item.pricesVnd[order.channel] ?? 0)}
                    </span>
                    <span className="bg-brand text-white px-2 py-2 text-center text-xs leading-tight flex-1 flex flex-col justify-center">
                      <span className="font-medium">{item.name.en}</span>
                      <span className="opacity-80">{item.name.vi}</span>
                      {item.options?.length ? (
                        <span className="opacity-70 mt-0.5">asks · có tuỳ chọn</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {qrPayload && (
            <div className="rounded-2xl border border-border p-4 space-y-2">
              <p className="text-sm font-semibold">
                Show this to the guest <span className="text-muted">· Đưa khách quét</span>
              </p>
              <p className="text-xs text-muted break-all font-mono">{qrPayload}</p>
              <p className="text-xs text-muted">
                Waiting for the transfer to land · Đang chờ chuyển khoản — this confirms itself.
              </p>
            </div>
          )}
        </div>
      </div>

      {asking && (
        <AddItemPanel
          item={asking}
          channel={order.channel}
          onCancel={() => setAsking(null)}
          onConfirm={(choices, qty, note) => addWithChoices(asking, choices, qty, note)}
        />
      )}

      {/* The order, pulled up from the bottom */}
      {bill && (
        <div className="fixed z-30 bottom-16 md:bottom-0 left-0 right-0 md:left-64 border-t border-border bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.10)]">
          {/* The grab handle. A full-width target rather than the chevron
              alone — this gets tapped one-handed while carrying plates. */}
          <button
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? "Hide the order" : "Show the order"}
            className="w-full py-2 flex flex-col items-center justify-center gap-0.5"
          >
            {sheetOpen ? (
              <ChevronDown size={22} className="text-muted" />
            ) : (
              <ChevronUp size={22} className="text-muted" />
            )}
            {sheetOpen && (
              <span className="text-sm font-semibold">
                Item list <span className="text-muted font-normal">· Danh sách món</span>
              </span>
            )}
          </button>

          {sheetOpen && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-border divide-y divide-border">
              {liveLines.map((line) => {
                const item = menu.find((m) => m.id === line.menuItemId);
                return (
                  <div key={line.id} className="flex items-center gap-2 px-4 md:px-8 py-2.5">
                    <div className="flex-1 min-w-0">
                      {item ? (
                        <Bi value={item.name} mode="inline" className="text-sm font-medium" />
                      ) : (
                        <span className="text-sm text-muted">Removed item</span>
                      )}
                      {line.choices?.length ? (
                        <p className="text-xs text-brand font-medium mt-0.5">
                          {line.choices.map((c) => `${c.label.en} · ${c.label.vi}`).join(" · ")}
                        </p>
                      ) : null}
                      {line.note && <p className="text-xs text-muted mt-0.5">{line.note}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => bump(line.id, -1)}
                        aria-label="One fewer"
                        className="w-10 h-10 rounded-lg border border-border grid place-items-center active:scale-95"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-7 text-center tabular-nums font-semibold">{line.qty}</span>
                      <button
                        onClick={() => bump(line.id, 1)}
                        aria-label="One more"
                        className="w-10 h-10 rounded-lg border border-border grid place-items-center active:scale-95"
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

              {order.discount && (
                <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-2.5 bg-brand-light">
                  <span className="text-sm">
                    <Bi value={order.discount.label} mode="inline" className="font-medium" />
                    <span className="block text-xs text-muted">
                      {order.discount.appliedBy ?? "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-semibold">−{vnd(bill.discountVnd)}</span>
                    <button
                      onClick={() => {
                        setDiscount(order.id, null);
                        load();
                      }}
                      aria-label="Remove the discount"
                      className="w-10 h-10 rounded-lg grid place-items-center text-muted"
                    >
                      <X size={16} />
                    </button>
                  </span>
                </div>
              )}

              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 md:px-8 py-2 text-sm">
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

          {showPromotions && mayTakeMoney && (
            <div className="border-t border-border px-4 md:px-8 py-3 space-y-2 max-h-[40vh] overflow-y-auto">
              {promotions.map((promotion) => (
                <button
                  key={promotion.id}
                  onClick={() => applyPromotion(promotion)}
                  className="w-full min-h-[52px] rounded-xl border border-border px-4 flex items-center justify-between active:scale-[0.99]"
                >
                  <Bi value={promotion.label} mode="inline" className="text-sm font-medium" />
                  <span className="text-sm text-muted tabular-nums shrink-0">
                    {promotion.kind === "percent" ? `${promotion.value}%` : vnd(promotion.value)}
                  </span>
                </button>
              ))}
              {promotions.length === 0 && (
                <p className="text-sm text-muted text-center py-2">
                  No promotions set up · Chưa có khuyến mãi
                </p>
              )}
            </div>
          )}

          <div className="px-4 md:px-8 pt-1 pb-2 flex items-end justify-between gap-3 border-t border-border">
            <span>
              <span className="block text-lg font-bold tabular-nums">
                Amount: {vnd(bill.totalVnd)}
              </span>
              <span className="block text-sm text-muted">
                {liveLines.length} {liveLines.length === 1 ? "item" : "items"} ·{" "}
                {liveLines.length} món
                {bill.discountVnd > 0 && (
                  <span className="line-through ml-2 tabular-nums">{vnd(bill.subtotalVnd)}</span>
                )}
              </span>
            </span>
          </div>

          {mayTakeMoney && (
            <div className="px-4 md:px-8 pb-3 flex gap-2">
              {bill.outstandingVnd > 0 ? (
                <>
                  <button
                    onClick={() => setShowPromotions((v) => !v)}
                    aria-label="Discounts and promotions"
                    className={`min-h-[52px] w-14 rounded-xl border grid place-items-center active:scale-[0.98] ${
                      showPromotions || order.discount
                        ? "border-brand text-brand"
                        : "border-border"
                    }`}
                  >
                    <Tag size={18} />
                  </button>
                  <button
                    onClick={() => pay("cash")}
                    className="flex-1 min-h-[52px] rounded-xl bg-brand text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Banknote size={18} /> Cash
                  </button>
                  <button
                    onClick={() => pay("vietqr")}
                    disabled={!vietQrConfigured()}
                    title={vietQrConfigured() ? undefined : "Add the bank account in Settings first"}
                    className="flex-1 min-h-[52px] rounded-xl border border-border font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
                  >
                    <QrCode size={18} /> Transfer
                  </button>
                  <button
                    onClick={() => pay("card")}
                    className="flex-1 min-h-[52px] rounded-xl border border-border font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <CreditCard size={18} /> Card
                  </button>
                </>
              ) : liveLines.length === 0 ? (
                // Nothing ordered yet. Closing would be refused anyway, and
                // offering it invites a tap that only produces an error.
                <p className="flex-1 min-h-[52px] rounded-xl border border-dashed border-border grid place-items-center text-sm text-muted text-center px-3">
                  Tap a dish to start · Chạm vào món để bắt đầu
                </p>
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
