"use client";

import { useEffect, useMemo, useState, use as usePromise } from "react";
import Image from "next/image";
import { CheckCircle2, Plus, Minus, ShoppingBag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MENU_CATEGORY_LABEL } from "@/lib/menuLabels";
import { getMenuItems } from "@/lib/repo/menu";
import { resolveToken } from "@/lib/repo/tableTokens";
import { createOrder, addLine } from "@/lib/repo/orders";
import type { MenuItem, RecipeCategory } from "@/lib/types";

/**
 * The guest's ordering page — what a QR sticker on the table opens.
 *
 * Public and unauthenticated, like /book. Built for a stranger's phone on the
 * restaurant's wifi: no login, no app, bilingual, and light enough to work on
 * a bad connection while the kitchen is busy.
 *
 * Prices come from the Menu module, which is already the single source of
 * truth across dine-in and delivery. There is no second price list here.
 */

const CATEGORY_ORDER: RecipeCategory[] = [
  "starter",
  "main",
  "side",
  "dessert",
  "beverage",
  "cocktail",
  "roast_sunday",
];

type CartLine = { item: MenuItem; qty: number };

export default function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [tableId, setTableId] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    const resolved = resolveToken(token);
    setTableId(resolved?.tableId ?? null);
    setItems(getMenuItems().filter((i) => i.pricesVnd.dine_in !== null));
  }, [token]);

  const lines: CartLine[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ item: items.find((i) => i.id === id)!, qty }))
        .filter((l) => l.item),
    [cart, items]
  );

  const total = lines.reduce((sum, l) => sum + (l.item.pricesVnd.dine_in ?? 0) * l.qty, 0);

  const bump = (id: string, by: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + by) }));

  const send = () => {
    if (!tableId || lines.length === 0) return;
    setSending(true);
    // Guests do not have a name in the app, so the order is unattributed —
    // `placedBy: null` is what distinguishes a QR order from a waiter's.
    const order = createOrder({
      tableId,
      source: "qr",
      channel: "dine_in",
      placedBy: null,
      guestNote: note.trim() || undefined,
    });
    for (const line of lines) addLine(order.id, line.item.id, line.qty);
    setSending(false);
    setPlaced(true);
  };

  // An unknown or retired token. Deliberately vague: someone probing tokens
  // from outside should learn nothing about which ones exist.
  if (tableId === null) {
    return (
      <Shell>
        <div className="text-center py-10">
          <AlertTriangle size={40} className="text-warning mx-auto mb-3" />
          <p className="font-bold">This code isn&apos;t active</p>
          <p className="text-sm text-muted mt-1">Mã này không hoạt động</p>
          <p className="text-sm text-muted mt-3">
            Please ask a member of staff.
            <br />
            Vui lòng hỏi nhân viên.
          </p>
        </div>
      </Shell>
    );
  }

  if (placed) {
    return (
      <Shell>
        <div className="text-center py-10">
          <CheckCircle2 size={44} className="text-success mx-auto mb-3" />
          <p className="font-bold text-lg">Order sent to the kitchen</p>
          <p className="text-sm text-muted mt-1">Đã gửi đơn xuống bếp</p>
          <p className="text-sm text-muted mt-4">
            Pay at the end of your meal — cash, card or bank transfer.
            <br />
            Thanh toán khi ăn xong — tiền mặt, thẻ hoặc chuyển khoản.
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => { setPlaced(false); setCart({}); setNote(""); }}>
            Order something else · Gọi thêm món
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-center text-sm text-muted mb-4">
        Order from your table · Gọi món tại bàn
      </p>

      {CATEGORY_ORDER.map((category) => {
        const inCategory = items.filter((i) => i.category === category);
        if (inCategory.length === 0) return null;
        return (
          <section key={category} className="mb-5">
            <h2 className="font-bold text-sm mb-0.5">{MENU_CATEGORY_LABEL[category].en}</h2>
            <p className="text-xs text-muted mb-2">{MENU_CATEGORY_LABEL[category].vi}</p>
            <div className="space-y-2">
              {inCategory.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${
                      qty > 0 ? "border-brand bg-brand-light" : "border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{item.name.en}</p>
                      <p className="text-xs text-muted">{item.name.vi}</p>
                      <p className="text-sm font-bold mt-0.5 tabular-nums">
                        {(item.pricesVnd.dine_in ?? 0).toLocaleString("vi-VN")}₫
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => bump(item.id, -1)}
                            aria-label={`One less ${item.name.en}`}
                            className="w-11 h-11 rounded-xl border-2 border-border flex items-center justify-center"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => bump(item.id, 1)}
                        aria-label={`One more ${item.name.en}`}
                        className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {lines.length > 0 && (
        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-5 bg-surface border-t-2 border-border safe-bottom">
          <label className="block mb-2">
            <span className="text-xs text-muted">Anything we should know? · Cần lưu ý gì không?</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Allergies, no spice… · Dị ứng, không cay…"
              className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm mt-1"
            />
          </label>
          <Button className="w-full min-h-14" disabled={sending} onClick={send}>
            <ShoppingBag size={18} className="mr-2" />
            {sending ? "Sending… · Đang gửi…" : `Send order · Gửi đơn — ${total.toLocaleString("vi-VN")}₫`}
          </Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background safe-top">
      <div className="max-w-md mx-auto px-5 py-6">
        <div className="flex justify-center mb-4">
          <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={120} height={85} priority />
        </div>
        {children}
      </div>
    </div>
  );
}
