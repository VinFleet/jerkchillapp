"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  ChevronLeft,
  MoreVertical,
  Send,
  Printer,
  Tag,
  X,
  ArrowLeftRight,
  Ban,
  StickyNote,
  Camera,
  Loader2,
  Eye,
  Scissors,
  Merge,
  FilePlus2,
  UserRound,
  ClipboardList,
} from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { Bi } from "@/components/Bi";
import { useSession } from "@/lib/auth/RoleContext";
import { canTakePayment } from "@/lib/auth/permissions";
import { onSyncedDataChanged } from "@/lib/sync/engine";
import {
  getOrder,
  getPayments,
  getBill,
  setLineStatus,
  setLineQty,
  takePayment,
  closeOrder,
  confirmPaymentByReference,
  setDiscount,
  sendToKitchen,
  unsentLines,
  setOrderStatus,
  moveOrderToTable,
  setOrderNote,
  setLineNote,
  setPaymentSlip,
  splitOrder,
  mergeOrders,
  addAdHocLine,
  setOrderCustomer,
  createOrder,
  getOrders,
} from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getPromotions } from "@/lib/repo/promotions";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getPaymentSettings, vietQrConfigured } from "@/lib/repo/paymentSettings";
import { buildVietQrPayload } from "@/lib/payments/vietqr";
import { VietQrCode } from "@/components/VietQrCode";
import { changeDueVnd, cashSuggestionsVnd, orderCode, clampPartialPayment } from "@/lib/repo/orderRules";
import { uploadCardSlip, cardSlipUrl } from "@/lib/payments/slips";
import { printKitchenTicket, printReceipt } from "@/lib/print/jobs";
import { getPrinterSettings } from "@/lib/repo/printerSettings";
import { getActiveTenant } from "@/lib/storage";
import type { Order, MenuItem, Payment, PaymentMethod, Promotion } from "@/lib/types";

/**
 * The order, before it becomes money.
 *
 * Everything that is not "choose a dish" happens here: sending the round,
 * discounting it, taking payment, and the handful of things that go wrong at
 * a table — wrong table, order abandoned. Splitting it off the menu screen is
 * what lets the menu be a menu; a waiter mid-round is not deciding about tax.
 */

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

const METHOD_LABEL: Record<PaymentMethod, { en: string; vi: string }> = {
  cash: { en: "Cash", vi: "Tiền mặt" },
  vietqr: { en: "Transfer", vi: "Chuyển khoản" },
  card: { en: "Card", vi: "Thẻ" },
};

function ReviewContent() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const { session } = useSession();
  const mayTakeMoney = session ? canTakePayment(session.role) : false;

  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [panel, setPanel] = useState<
    "none" | "promotions" | "more" | "tables" | "split" | "merge" | "adhoc" | "customer"
  >("none");
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [orderNoteDraft, setOrderNoteDraft] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [received, setReceived] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [manualKind, setManualKind] = useState<"percent" | "amount">("percent");
  const [manualValue, setManualValue] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [cardRef, setCardRef] = useState("");
  const [slipBusy, setSlipBusy] = useState(false);
  const [slipProblem, setSlipProblem] = useState<string | null>(null);
  const slipInput = useRef<HTMLInputElement>(null);
  const [pendingSlip, setPendingSlip] = useState<File | null>(null);
  const [splitPick, setSplitPick] = useState<string[]>([]);
  const [adHoc, setAdHoc] = useState({ name: "", price: "", qty: "1" });
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  const load = useCallback(() => {
    setOrder(getOrder(orderId) ?? null);
    setPayments(getPayments(orderId));
    setMenu(getMenuItems(false));
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

  useEffect(() => {
    if (!pendingRefs) return;
    const refs = pendingRefs.split(",");
    let stop = false;
    const check = async () => {
      for (const reference of refs) {
        try {
          const res = await fetch(`/api/payments/status?reference=${encodeURIComponent(reference)}&branch=${encodeURIComponent(getActiveTenant())}`);
          if (!res.ok) continue;
          const body = (await res.json()) as { status?: string; providerRef?: string; provider?: string };
          if (body.status === "paid" && body.providerRef) {
            confirmPaymentByReference(reference, body.providerRef, body.provider ?? "bank");
            if (!stop) load();
          }
        } catch {
          // Offline. Cash still works, and a banner would help nobody.
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

  const tableId = order?.tableId ?? null;
  const tables = useMemo(() => getCachedTables(), []);
  const tableNumber = useMemo(
    () => (tableId ? (tables.find((t) => t.id === tableId)?.tableNumber ?? null) : null),
    [tableId, tables]
  );

  if (!order) return <p className="p-8 text-center text-muted">Order not found · Không tìm thấy đơn</p>;

  const bill = getBill(order.id);
  const lines = order.lines.filter((l) => l.status !== "cancelled");
  const waiting = unsentLines(order);

  const flash = (message: string) => {
    setNote(message);
    window.setTimeout(() => setNote(null), 2500);
  };

  const serveAllReady = () => {
    const ready = order?.lines.filter((l) => l.status === "ready") ?? [];
    for (const line of ready) setLineStatus(order!.id, line.id, "served");
    load();
    flash(`Served ${ready.length} · Đã phục vụ ${ready.length} món`);
  };

  const send = () => {
    // Capture which lines this round is BEFORE stamping them, so the printed
    // ticket is this round only — a second round is a second piece of paper.
    const roundIds = unsentLines(order).map((l) => l.id);
    const count = sendToKitchen(order.id);
    load();
    if (count > 0 && roundIds.length > 0 && getPrinterSettings().autoPrintKitchen) {
      const fresh = getOrder(order.id);
      if (fresh)
        void printKitchenTicket(fresh, roundIds).then((queued) => {
          if (!queued) flash("Sent — printer offline, use the ticket screen · Máy in chưa kết nối");
        });
    }
    flash(
      count > 0
        ? `Sent ${count} to the kitchen · Đã gửi ${count} món`
        : "Everything here has already been sent · Đã gửi hết rồi"
    );
  };

  const pay = (method: PaymentMethod, providerRef?: string) => {
    if (!bill || bill.outstandingVnd <= 0) return;
    // Sending on payment covers the waiter who takes the money first — the
    // kitchen must never learn about a round only after it is paid for.
    const unsentIds = unsentLines(order).map((l) => l.id);
    if (unsentIds.length > 0) {
      sendToKitchen(order.id);
      const fresh = getOrder(order.id);
      if (fresh && getPrinterSettings().autoPrintKitchen) void printKitchenTicket(fresh, unsentIds);
    }

    // Half the table pays cash, the rest goes on a QR: each payment takes
    // what the amount field says, capped at what is owed. An empty field
    // means all of it, so the common case costs no taps.
    const payment = takePayment({
      orderId: order.id,
      method,
      amountVnd: clampPartialPayment(Number(payAmount || 0), bill.outstandingVnd),
      takenBy: session?.name ?? null,
      providerRef,
    });
    setPayAmount("");

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
      // The receipt goes to paper as the table closes — the guest is standing
      // up. Enqueued before navigating so the payload still has the order.
      if (getPrinterSettings().autoPrintReceiptOnClose) void printReceipt(order);
      router.push("/service");
      return;
    }
    setProblem(
      verdict.reason === "awaiting_payment"
        ? "A payment is still unconfirmed — wait for it, or mark it failed. Thanh toán chưa xác nhận."
        : verdict.reason === "unpaid"
          ? "This bill is not fully paid. Hoá đơn chưa thanh toán đủ."
          : "This order has nothing on it. Đơn này chưa có món."
    );
  };

  const cancelOrder = () => {
    setOrderStatus(order.id, "cancelled");
    router.push("/service");
  };

  const moveTable = (toTableId: string) => {
    moveOrderToTable(order.id, toTableId);
    setPanel("none");
    load();
    flash("Moved · Đã chuyển bàn");
  };

  return (
    <div className="pb-64">
      <header className="sticky top-0 z-20 bg-surface border-b border-border flex items-center gap-2 px-2 py-2">
        <Link
          href={`/service/${order.id}`}
          aria-label="Back to the menu"
          className="w-11 h-11 rounded-lg grid place-items-center"
        >
          <ChevronLeft size={22} />
        </Link>
        <span className="flex-1 min-w-0">
          <span className="block font-bold leading-tight">
            {tableNumber ? `Table ${tableNumber}` : "Counter · Quầy"}
          </span>
          <span className="block text-xs text-muted">
            {order.placedBy ?? "Ordered by guest · Khách tự gọi"}
          </span>
        </span>
        <button
          onClick={() => setPanel(panel === "more" ? "none" : "more")}
          aria-label="More actions"
          className="w-11 h-11 rounded-lg grid place-items-center"
        >
          <MoreVertical size={20} />
        </button>
      </header>

      {note && (
        <p className="mx-4 mt-3 text-sm rounded-xl bg-success-tint text-success px-3 py-2 flex items-center gap-2">
          <Check size={16} /> {note}
        </p>
      )}
      {problem && (
        <p className="mx-4 mt-3 text-sm rounded-xl border border-warning bg-warning-tint text-warning px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {problem}
        </p>
      )}

      {panel === "more" && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
          <button onClick={send} className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left">
            <Send size={18} className="text-muted shrink-0" />
            Send to kitchen <span className="text-muted">· Gửi bếp</span>
          </button>
          <button
            onClick={() => {
              void printReceipt(order).then((queued) =>
                flash(
                  queued
                    ? "Bill sent to the printer · Đã gửi máy in"
                    : "Printer offline — opening the on-screen bill · Máy in chưa kết nối"
                )
              );
              setPanel("none");
            }}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <Printer size={18} className="text-muted shrink-0" />
            Print the bill <span className="text-muted">· In hoá đơn</span>
          </button>
          <Link
            href={`/service/${order.id}/bill`}
            className="w-full min-h-[56px] px-4 flex items-center gap-3"
          >
            <Printer size={18} className="text-muted shrink-0" />
            Bill on screen <span className="text-muted">· Xem hoá đơn</span>
          </Link>
          <button
            onClick={() => setPanel("tables")}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <ArrowLeftRight size={18} className="text-muted shrink-0" />
            Change table <span className="text-muted">· Đổi bàn</span>
          </button>
          <Link
            href={`/service/${order.id}/ticket`}
            className="w-full min-h-[56px] px-4 flex items-center gap-3"
          >
            <ClipboardList size={18} className="text-muted shrink-0" />
            Print the kitchen ticket <span className="text-muted">· In phiếu bếp</span>
          </Link>
          <button
            onClick={() => {
              setSplitPick([]);
              setPanel("split");
            }}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <Scissors size={18} className="text-muted shrink-0" />
            Split the bill <span className="text-muted">· Tách hoá đơn</span>
          </button>
          <button
            onClick={() => setPanel("merge")}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <Merge size={18} className="text-muted shrink-0" />
            Merge with another table <span className="text-muted">· Gộp bàn</span>
          </button>
          <button
            onClick={() => setPanel("adhoc")}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <FilePlus2 size={18} className="text-muted shrink-0" />
            Add an off-menu item <span className="text-muted">· Thêm món ngoài menu</span>
          </button>
          <button
            onClick={() => {
              setCustomer({ name: order.customerName ?? "", phone: order.customerPhone ?? "" });
              setPanel("customer");
            }}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <UserRound size={18} className="text-muted shrink-0" />
            {order.customerName ? order.customerName : "Add the guest's name"}{" "}
            <span className="text-muted">· Khách hàng</span>
          </button>
          <button
            onClick={() => {
              const created = createOrder({
                tableId: order.tableId,
                source: order.source,
                channel: order.channel,
                placedBy: session?.name ?? null,
              });
              router.push(`/service/${created.id}`);
            }}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left"
          >
            <FilePlus2 size={18} className="text-muted shrink-0" />
            Second bill on this table <span className="text-muted">· Hoá đơn thứ hai</span>
          </button>
          <button
            onClick={cancelOrder}
            className="w-full min-h-[56px] px-4 flex items-center gap-3 text-left text-danger"
          >
            <Ban size={18} className="shrink-0" />
            Cancel the order <span className="opacity-70">· Huỷ đơn</span>
          </button>
        </div>
      )}

      {panel === "split" && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface p-3 space-y-2">
          <p className="text-sm font-semibold">
            Which items are paying separately?{" "}
            <span className="text-muted font-normal">· Món nào thanh toán riêng?</span>
          </p>
          {payments.some((p) => p.status === "paid" || p.status === "pending") ? (
            <p className="text-sm text-warning">
              Money has been taken on this bill, so it can no longer be split.
              · Đã có thanh toán, không thể tách nữa.
            </p>
          ) : (
            <>
              {lines.map((line) => {
                const item = menu.find((m) => m.id === line.menuItemId);
                const picked = splitPick.includes(line.id);
                return (
                  <button
                    key={line.id}
                    onClick={() =>
                      setSplitPick((p) =>
                        picked ? p.filter((id) => id !== line.id) : [...p, line.id]
                      )
                    }
                    className={`w-full min-h-[52px] rounded-xl border-2 px-3 flex items-center justify-between text-left ${
                      picked ? "border-brand bg-brand-light" : "border-border"
                    }`}
                  >
                    <span className="text-sm">
                      {line.qty}× {item?.name.en ?? line.menuItemId.replace("adhoc:", "")}
                    </span>
                    <span className="text-sm tabular-nums">{vnd(line.unitPriceVnd * line.qty)}</span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  const result = splitOrder(order.id, splitPick, session?.name ?? null);
                  if (result.ok) {
                    router.push(`/service/${result.newOrderId}/review`);
                  } else {
                    setProblem(
                      result.reason === "everything_selected"
                        ? "That is everything — leave at least one item behind. · Phải để lại ít nhất một món."
                        : "Could not split · Không tách được"
                    );
                    setPanel("none");
                  }
                }}
                disabled={splitPick.length === 0 || splitPick.length === lines.length}
                className="w-full min-h-[52px] rounded-xl bg-brand text-white font-semibold disabled:bg-border disabled:text-muted"
              >
                Split {splitPick.length} onto a new bill · Tách {splitPick.length} món
              </button>
            </>
          )}
        </div>
      )}

      {panel === "merge" && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface p-3 space-y-2">
          <p className="text-sm font-semibold">
            Bring which bill into this one?{" "}
            <span className="text-muted font-normal">· Gộp hoá đơn nào vào đây?</span>
          </p>
          {getOrders()
            .filter(
              (o) =>
                o.id !== order.id &&
                o.status !== "closed" &&
                o.status !== "cancelled" &&
                o.lines.some((l) => l.status !== "cancelled")
            )
            .map((other) => {
              const otherTable = tables.find((t) => t.id === other.tableId)?.tableNumber;
              const total = other.lines
                .filter((l) => l.status !== "cancelled")
                .reduce((sum, l) => sum + l.unitPriceVnd * l.qty, 0);
              return (
                <button
                  key={other.id}
                  onClick={() => {
                    const result = mergeOrders(order.id, other.id);
                    if (!result.ok) {
                      setProblem(
                        result.reason === "paid"
                          ? "One of these bills has money on it — settle it first. · Một hoá đơn đã có thanh toán."
                          : "Could not merge · Không gộp được"
                      );
                    }
                    setPanel("none");
                    load();
                  }}
                  className="w-full min-h-[56px] rounded-xl border border-border px-3 flex items-center justify-between text-left"
                >
                  <span className="text-sm font-semibold">
                    {otherTable ? `Table ${otherTable}` : "Counter"}{" "}
                    <span className="text-muted font-normal font-mono">{orderCode(other.id)}</span>
                  </span>
                  <span className="text-sm tabular-nums">{vnd(total)}</span>
                </button>
              );
            })}
        </div>
      )}

      {panel === "adhoc" && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface p-3 space-y-2">
          <p className="text-sm font-semibold">
            Off-menu item <span className="text-muted font-normal">· Món ngoài thực đơn</span>
          </p>
          <input
            value={adHoc.name}
            onChange={(e) => setAdHoc({ ...adHoc, name: e.target.value })}
            placeholder="Chef's special, corkage… · Món đặc biệt…"
            className="w-full min-h-[48px] rounded-xl border border-border px-3 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={adHoc.price}
              onChange={(e) => setAdHoc({ ...adHoc, price: e.target.value.replace(/[^\d]/g, "") })}
              inputMode="numeric"
              placeholder="Price · Giá (₫)"
              className="flex-1 min-w-0 min-h-[48px] rounded-xl border border-border px-3 text-sm tabular-nums"
            />
            <input
              value={adHoc.qty}
              onChange={(e) => setAdHoc({ ...adHoc, qty: e.target.value.replace(/[^\d]/g, "") })}
              inputMode="numeric"
              className="w-20 min-h-[48px] rounded-xl border border-border px-3 text-sm tabular-nums text-center"
            />
            <button
              onClick={() => {
                if (!adHoc.name.trim() || !Number(adHoc.price)) return;
                addAdHocLine(order.id, adHoc.name, Number(adHoc.price), Number(adHoc.qty) || 1);
                setAdHoc({ name: "", price: "", qty: "1" });
                setPanel("none");
                load();
              }}
              disabled={!adHoc.name.trim() || !Number(adHoc.price)}
              className="min-h-[48px] px-4 rounded-xl bg-brand text-white font-semibold text-sm disabled:bg-border disabled:text-muted"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-muted">
            Shows on the ticket and the bill by this name; flagged apart from real dishes in
            reports. · Hiện trên phiếu và hoá đơn với tên này.
          </p>
        </div>
      )}

      {panel === "customer" && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface p-3 space-y-2">
          <p className="text-sm font-semibold">
            Who is this for? <span className="text-muted font-normal">· Khách hàng</span>
          </p>
          <input
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            placeholder="Name · Tên"
            className="w-full min-h-[48px] rounded-xl border border-border px-3 text-sm"
          />
          <input
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            inputMode="tel"
            placeholder="Phone (optional) · SĐT (không bắt buộc)"
            className="w-full min-h-[48px] rounded-xl border border-border px-3 text-sm"
          />
          <button
            onClick={() => {
              setOrderCustomer(order.id, customer.name, customer.phone || undefined);
              setPanel("none");
              load();
            }}
            className="w-full min-h-[48px] rounded-xl bg-brand text-white font-semibold text-sm"
          >
            Save · Lưu
          </button>
        </div>
      )}

      {panel === "tables" && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-surface p-3">
          <p className="text-sm font-semibold mb-2">
            Move to which table? <span className="text-muted font-normal">· Chuyển sang bàn nào?</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => moveTable(t.id)}
                disabled={t.id === order.tableId}
                className="min-h-[52px] rounded-xl border border-border font-semibold disabled:opacity-30"
              >
                {t.tableNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-3">
        {lines.length === 0 ? (
          <p className="text-center text-muted py-10 text-sm">
            Nothing on this order yet · Đơn này chưa có món
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {lines.map((line) => {
              const item = menu.find((m) => m.id === line.menuItemId);
              return (
                <div key={line.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm">
                        {item?.name.en ?? line.menuItemId.replace("adhoc:", "")}
                      </span>
                      <span className="block text-xs text-muted">{item?.name.vi}</span>
                      {line.choices?.length ? (
                        <span className="block text-xs text-brand font-medium mt-0.5">
                          {line.choices.map((c) => `${c.label.en} · ${c.label.vi}`).join(" · ")}
                        </span>
                      ) : null}
                      {line.note && <span className="block text-xs text-muted mt-0.5">{line.note}</span>}
                      {!line.sentAt && (
                        <span className="block text-xs text-warning font-medium mt-0.5">
                          Not sent yet · Chưa gửi bếp
                        </span>
                      )}
                      {/* Where this line is in the kitchen. The waiter's half
                          of the status conversation is the last step: the
                          kitchen says ready, the waiter carries it and says
                          served. Everything before that is read-only here —
                          claiming a dish is the kitchen's tap, not the floor's. */}
                      {line.sentAt && line.status === "placed" && (
                        <span className="block text-xs text-muted mt-0.5">Queued · Chờ bếp</span>
                      )}
                      {line.status === "preparing" && (
                        <span className="block text-xs text-warning font-semibold mt-0.5">
                          Cooking · Đang nấu
                        </span>
                      )}
                      {line.status === "served" && (
                        <span className="block text-xs text-success font-medium mt-0.5">
                          ✓ Served · Đã phục vụ
                        </span>
                      )}
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-bold tabular-nums">
                        {vnd(line.unitPriceVnd * line.qty)}
                      </span>
                      {line.status === "ready" && (
                        <button
                          onClick={() => {
                            setLineStatus(order.id, line.id, "served");
                            load();
                          }}
                          className="mt-1 min-h-[40px] px-3 rounded-lg bg-success text-white text-xs font-bold"
                        >
                          READY — served? · XONG
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setLineStatus(order.id, line.id, "cancelled");
                        load();
                      }}
                      aria-label="Take off the bill"
                      className="w-11 h-11 rounded-lg grid place-items-center text-muted"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingNote(editingNote === line.id ? null : line.id);
                        setNoteDraft(line.note ?? "");
                      }}
                      aria-label="Note for this item"
                      className={`w-11 h-11 rounded-lg grid place-items-center mr-auto ${
                        line.note ? "text-brand" : "text-muted"
                      }`}
                    >
                      <StickyNote size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setLineQty(order.id, line.id, line.qty - 1);
                        load();
                      }}
                      aria-label="One fewer"
                      className="w-11 h-11 rounded-full border border-border grid place-items-center"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-bold tabular-nums">{line.qty}</span>
                    <button
                      onClick={() => {
                        setLineQty(order.id, line.id, line.qty + 1);
                        load();
                      }}
                      aria-label="One more"
                      className="w-11 h-11 rounded-full border border-border grid place-items-center"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {editingNote === line.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        maxLength={200}
                        autoFocus
                        placeholder="No onion, well done… · Không hành, chín kỹ…"
                        className="flex-1 min-h-[48px] rounded-xl border border-border px-3 text-sm"
                      />
                      <button
                        onClick={() => {
                          setLineNote(order.id, line.id, noteDraft);
                          setEditingNote(null);
                          load();
                        }}
                        className="min-h-[48px] px-4 rounded-xl bg-brand text-white font-semibold text-sm"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {order.discount && bill && (
              <div className="p-3 flex items-center justify-between gap-3 bg-brand-light">
                <span className="min-w-0">
                  <Bi value={order.discount.label} mode="inline" className="text-sm font-medium" />
                  <span className="block text-xs text-muted">{order.discount.appliedBy ?? "—"}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-bold tabular-nums">−{vnd(bill.discountVnd)}</span>
                  <button
                    onClick={() => {
                      setDiscount(order.id, null);
                      load();
                    }}
                    aria-label="Remove the discount"
                    className="w-9 h-9 rounded-lg grid place-items-center text-muted"
                  >
                    <X size={15} />
                  </button>
                </span>
              </div>
            )}

            {payments.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                <span>
                  {METHOD_LABEL[p.method].en}
                  <span className="text-muted"> · {METHOD_LABEL[p.method].vi}</span>
                  <span className="block text-xs text-muted font-mono">
                    {p.providerRef ? `${p.reference} · ${p.providerRef}` : p.reference}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  {p.slipPhotoPath && (
                    <button
                      onClick={async () => {
                        const url = await cardSlipUrl(p.slipPhotoPath!);
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className="text-xs text-brand flex items-center gap-1 ml-auto mb-0.5"
                    >
                      <Eye size={13} /> Slip · Ảnh
                    </button>
                  )}
                  <span className="block font-bold tabular-nums">{vnd(p.amountVnd)}</span>
                  <span
                    className={`text-xs ${
                      p.status === "paid" ? "text-success" : p.status === "pending" ? "text-warning" : "text-muted"
                    }`}
                  >
                    {p.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* One note for the whole table. An allergy is rarely about a single
            line — it is about the person, and everything they are served. */}
        <div className="mt-3 rounded-2xl border border-border bg-surface p-3">
          <label htmlFor="order-note" className="text-sm font-semibold flex items-center gap-1.5">
            <StickyNote size={15} className="text-muted" />
            Allergies &amp; preferences
            <span className="text-muted font-normal">· Dị ứng &amp; yêu cầu</span>
          </label>
          <textarea
            id="order-note"
            value={orderNoteDraft ?? order.orderNote ?? ""}
            onChange={(e) => setOrderNoteDraft(e.target.value)}
            onBlur={() => {
              if (orderNoteDraft === null) return;
              setOrderNote(order.id, orderNoteDraft);
              setOrderNoteDraft(null);
              load();
            }}
            rows={2}
            maxLength={300}
            placeholder="Nut allergy on table, no pork… · Dị ứng hạt, không thịt heo…"
            className="w-full mt-2 rounded-xl border border-border px-3 py-2 text-sm resize-none"
          />
          {order.guestNote && (
            <p className="text-xs text-muted mt-2">
              Guest wrote · Khách ghi: <span className="text-foreground">{order.guestNote}</span>
            </p>
          )}
        </div>

        {qrPayload && (
          <div className="rounded-2xl border-2 border-brand bg-surface p-4 mt-3 space-y-3 text-center">
            <p className="font-semibold">
              Scan to pay <span className="text-muted font-normal">· Quét để thanh toán</span>
            </p>
            <VietQrCode payload={qrPayload} />
            <p className="text-2xl font-black tabular-nums">{vnd(bill?.outstandingVnd ?? 0)}</p>
            <p className="text-sm text-muted">
              Waiting for the transfer · Đang chờ chuyển khoản
              <br />
              <span className="text-xs">This confirms itself — no need to watch it.</span>
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fixed z-30 bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-surface border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.10)]">
        {panel === "promotions" && mayTakeMoney && (
          <div className="px-4 py-3 space-y-2 max-h-[40vh] overflow-y-auto border-b border-border">
            {promotions.map((promotion) => (
              <button
                key={promotion.id}
                onClick={() => {
                  setDiscount(order.id, {
                    kind: promotion.kind,
                    value: promotion.value,
                    label: promotion.label,
                    promotionId: promotion.id,
                    appliedBy: session?.name ?? null,
                    appliedAt: new Date().toISOString(),
                  });
                  setPanel("none");
                  load();
                }}
                className="w-full min-h-[52px] rounded-xl border border-border px-4 flex items-center justify-between"
              >
                <Bi value={promotion.label} mode="inline" className="text-sm font-medium" />
                <span className="text-sm text-muted tabular-nums shrink-0">
                  {promotion.kind === "percent" ? `${promotion.value}%` : vnd(promotion.value)}
                </span>
              </button>
            ))}
            {promotions.length === 0 && (
              <p className="text-sm text-muted text-center py-2">No promotions · Chưa có khuyến mãi</p>
            )}

            {/* Anything not on the list. A one-off reduction still has to be
                recorded and attributed — it is the same money either way. */}
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-sm font-semibold">
                Or enter one <span className="text-muted font-normal">· Hoặc nhập tay</span>
              </p>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-border overflow-hidden shrink-0">
                  {(["percent", "amount"] as const).map((kind) => (
                    <button
                      key={kind}
                      onClick={() => setManualKind(kind)}
                      className={`min-h-[48px] w-14 font-semibold ${
                        manualKind === kind ? "bg-brand text-white" : "text-muted"
                      }`}
                    >
                      {kind === "percent" ? "%" : "₫"}
                    </button>
                  ))}
                </div>
                <input
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder={manualKind === "percent" ? "10" : "50000"}
                  className="flex-1 min-w-0 min-h-[48px] rounded-xl border border-border px-3 tabular-nums"
                />
                <button
                  onClick={() => {
                    const value = Number(manualValue);
                    if (!value) return;
                    setDiscount(order.id, {
                      kind: manualKind,
                      value,
                      label:
                        manualKind === "percent"
                          ? { en: `${value}% off`, vi: `Giảm ${value}%` }
                          : {
                              en: `${value.toLocaleString("vi-VN")}₫ off`,
                              vi: `Giảm ${value.toLocaleString("vi-VN")}₫`,
                            },
                      appliedBy: session?.name ?? null,
                      appliedAt: new Date().toISOString(),
                    });
                    setManualValue("");
                    setPanel("none");
                    load();
                  }}
                  disabled={!manualValue}
                  className="min-h-[48px] px-4 rounded-xl bg-brand text-white font-semibold disabled:bg-border disabled:text-muted shrink-0"
                >
                  Apply
                </button>
              </div>
              {manualKind === "percent" && Number(manualValue) > 100 && (
                <p className="text-xs text-warning">
                  Over 100% — it will be capped at the whole bill · Sẽ giới hạn ở toàn bộ hoá đơn
                </p>
              )}
            </div>
          </div>
        )}

        {lines.filter((l) => l.status === "ready").length > 1 && (
          <button
            onClick={serveAllReady}
            className="mx-4 mt-2 mb-1 min-h-[48px] w-[calc(100%-2rem)] rounded-xl bg-success text-white text-sm font-bold"
          >
            Whole tray delivered · Đã mang hết {lines.filter((l) => l.status === "ready").length} món
          </button>
        )}

        <div className="px-4 py-2 flex items-center justify-between gap-3 bg-brand-light">
          <span className="text-sm">
            Qty · SL: <span className="font-bold tabular-nums">{lines.reduce((n, l) => n + l.qty, 0)}</span>
          </span>
          <span className="text-sm">
            {bill && bill.discountVnd > 0 && (
              <span className="text-muted line-through tabular-nums mr-2">{vnd(bill.subtotalVnd)}</span>
            )}
            <span className="font-bold">TOTAL: {vnd(bill?.totalVnd ?? 0)}</span>
          </span>
        </div>

        {mayTakeMoney && bill && bill.outstandingVnd > 0 && (
          <div className="px-4 pt-2 flex gap-2">
            {/* The split field. Blank means the whole bill — the common case
                costs no taps; a split costs typing the first share. */}
            <label className="flex-1 flex items-center gap-2 min-h-[44px] rounded-xl border border-border px-3">
              <span className="text-xs text-muted shrink-0">Paying · Trả</span>
              <input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder={`${bill.outstandingVnd.toLocaleString("vi-VN")} (all · hết)`}
                className="w-full min-w-0 text-right tabular-nums font-semibold bg-transparent outline-none"
              />
            </label>
            <button
              onClick={() => setPanel(panel === "promotions" ? "none" : "promotions")}
              aria-label="Promotions and discounts · Khuyến mãi"
              className={`min-h-[44px] w-12 rounded-xl border grid place-items-center shrink-0 ${
                panel === "promotions" || order.discount ? "border-brand text-brand" : "border-border"
              }`}
            >
              <Tag size={15} />
            </button>
          </div>
        )}

        <div className="px-4 py-3 flex gap-2">
          <Link
            href={`/service/${order.id}`}
            className="flex-1 min-h-[52px] rounded-xl bg-success text-white font-semibold flex items-center justify-center gap-1.5"
          >
            <Plus size={18} /> Add · Thêm
          </Link>
          <button
            onClick={send}
            disabled={waiting.length === 0}
            className="flex-1 min-h-[52px] rounded-xl border-2 border-brand text-brand font-semibold flex items-center justify-center gap-1.5 disabled:border-border disabled:text-muted"
          >
            <Send size={17} /> {waiting.length > 0 ? `Save (${waiting.length})` : "Saved"}
          </button>
          {mayTakeMoney &&
            (bill && bill.outstandingVnd > 0 ? (
              <button
                onClick={() => setPanel(panel === "none" ? "none" : "none")}
                className="flex-1 min-h-[52px] rounded-xl bg-brand text-white font-semibold"
                // Payment methods sit directly below; this keeps the row's shape
                // identical to the till the team already uses.
                disabled
                style={{ display: "none" }}
              >
                Pay
              </button>
            ) : (
              <button
                onClick={finish}
                className="flex-1 min-h-[52px] rounded-xl bg-success text-white font-semibold flex items-center justify-center gap-1.5"
              >
                <Check size={18} /> Close · Đóng bàn
              </button>
            ))}
        </div>

        {cashOpen && bill && bill.outstandingVnd > 0 && (
          <div className="px-4 py-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="received" className="text-sm">
                Received <span className="text-muted">· Khách đưa</span>
              </label>
              <input
                id="received"
                value={received}
                onChange={(e) => setReceived(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder={String(bill.outstandingVnd)}
                className="w-40 min-h-[48px] rounded-xl border border-border px-3 text-right tabular-nums font-semibold"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {cashSuggestionsVnd(clampPartialPayment(Number(payAmount || 0), bill.outstandingVnd)).map((amount) => (
                <button
                  key={amount}
                  onClick={() => setReceived(String(amount))}
                  className="min-h-[44px] px-4 rounded-full border border-border text-sm tabular-nums"
                >
                  {amount.toLocaleString("vi-VN")}
                </button>
              ))}
            </div>

            {/* The number the waiter actually needs, big enough to read while
                counting notes out of the drawer. */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted">Change · Tiền thừa</span>
              <span className="text-2xl font-black tabular-nums">
                {vnd(changeDueVnd(Number(received || 0), clampPartialPayment(Number(payAmount || 0), bill.outstandingVnd)))}
              </span>
            </div>

            <button
              onClick={() => {
                pay("cash");
                setCashOpen(false);
                setReceived("");
              }}
              className="w-full min-h-[52px] rounded-xl bg-success text-white font-semibold"
            >
              Take {vnd(clampPartialPayment(Number(payAmount || 0), bill.outstandingVnd))} · Nhận tiền
            </button>
          </div>
        )}

        {cardOpen && bill && bill.outstandingVnd > 0 && (
          <div className="px-4 py-3 border-t border-border space-y-2">
            <label htmlFor="card-ref" className="text-sm block">
              Card slip reference <span className="text-muted">· Mã trên hoá đơn thẻ</span>
            </label>
            <input
              id="card-ref"
              value={cardRef}
              onChange={(e) => setCardRef(e.target.value.toUpperCase().slice(0, 32))}
              autoCapitalize="characters"
              placeholder="Approval / trace no."
              className="w-full min-h-[48px] rounded-xl border border-border px-3 font-mono tabular-nums"
            />
            <p className="text-xs text-muted">
              The terminal settles separately, so this is what the closed order is
              matched against at cash-up.
              <br />
              Máy thẻ đối soát riêng — mã này để khớp đơn khi chốt ca.
            </p>
            <input
              ref={slipInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                setPendingSlip(e.target.files?.[0] ?? null);
                setSlipProblem(null);
              }}
            />
            <button
              onClick={() => slipInput.current?.click()}
              className="w-full min-h-[52px] rounded-xl border border-border font-semibold flex items-center justify-center gap-2"
            >
              <Camera size={17} />
              {pendingSlip
                ? "Photo ready · Đã chụp — retake?"
                : "Photograph the slip · Chụp hoá đơn thẻ"}
            </button>

            <button
              onClick={async () => {
                setSlipBusy(true);
                const payment = takePayment({
                  orderId: order.id,
                  method: "card",
                  amountVnd: clampPartialPayment(Number(payAmount || 0), bill.outstandingVnd),
                  takenBy: session?.name ?? null,
                  providerRef: cardRef,
                });
                setPayAmount("");
                if (unsentLines(order).length > 0) sendToKitchen(order.id);

                // The payment is recorded first. A failed upload must never
                // lose the fact that money was taken — the photo is evidence
                // for cash-up, not the payment itself.
                const file = pendingSlip;
                if (file) {
                  const up = await uploadCardSlip(payment.id, file);
                  if (up.ok) setPaymentSlip(payment.id, up.path);
                  else
                    setSlipProblem(
                      "Payment recorded, but the photo did not upload · Đã ghi nhận thanh toán, ảnh chưa tải lên"
                    );
                }
                setPendingSlip(null);
                setSlipBusy(false);
                setCardOpen(false);
                setCardRef("");
                load();
              }}
              disabled={slipBusy}
              className="w-full min-h-[52px] rounded-xl bg-success text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {slipBusy ? <Loader2 size={17} className="animate-spin" /> : null}
              Take {vnd(clampPartialPayment(Number(payAmount || 0), bill.outstandingVnd))} on card · Nhận thẻ
            </button>

            {slipProblem && <p className="text-xs text-warning">{slipProblem}</p>}
            {!cardRef && !pendingSlip && (
              <p className="text-xs text-warning">
                No reference or photo — it will be harder to reconcile · Khó đối soát
              </p>
            )}
          </div>
        )}

        {mayTakeMoney && bill && bill.outstandingVnd > 0 && lines.length > 0 && (
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => setCashOpen((v) => !v)}
              className={`flex-1 min-h-[52px] rounded-xl font-semibold flex items-center justify-center gap-1.5 ${
                cashOpen ? "bg-brand-dark text-white" : "bg-brand text-white"
              }`}
            >
              <Banknote size={17} /> Cash
            </button>
            <button
              onClick={() => pay("vietqr")}
              disabled={!vietQrConfigured()}
              title={vietQrConfigured() ? undefined : "Add the bank account in Settings first"}
              className="flex-1 min-h-[52px] rounded-xl border border-border font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <QrCode size={17} /> Transfer
            </button>
            <button
              onClick={() => setCardOpen((v) => !v)}
              className={`flex-1 min-h-[52px] rounded-xl border font-semibold flex items-center justify-center gap-1.5 ${
                cardOpen ? "border-brand text-brand" : "border-border"
              }`}
            >
              <CreditCard size={17} /> Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <RoleGate module="orders">
      <ReviewContent />
    </RoleGate>
  );
}
