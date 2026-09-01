"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cashUpForDate } from "@/lib/repo/orders";
import { cardSlipUrl } from "@/lib/payments/slips";
import { Bi } from "@/components/Bi";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { getOrCreateEntry, updateEntry, totalSalesVnd, expectedCashVnd, cashVarianceVnd, zReportVarianceVnd } from "@/lib/repo/sales";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { DailySales, SalesChannel } from "@/lib/types";

const CHANNEL_LABEL: Record<SalesChannel, { en: string; vi: string }> = {
  eat_in: { en: "Eat In", vi: "Ăn tại chỗ" },
  takeaway: { en: "Takeaway", vi: "Mang về" },
  shopee: { en: "Shopee", vi: "Shopee" },
  grab: { en: "Grab", vi: "Grab" },
};

const CHANNEL_ORDER: SalesChannel[] = ["eat_in", "takeaway", "shopee", "grab"];

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}


function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === todayIso();
  return (
    <div className="flex items-center gap-2 px-4 md:px-8 mb-4">
      <button onClick={() => onChange(addDaysIso(date, -1))} className="w-11 h-11 flex items-center justify-center text-brand" aria-label="Previous day">
        <ChevronLeft size={20} />
      </button>
      <input
        type="date"
        value={date}
        max={todayIso()}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="flex-1 min-h-11 rounded-xl border-2 border-border px-3 text-sm text-center focus:outline-none focus:border-brand"
        aria-label="Pick a date"
      />
      {!isToday && (
        <button onClick={() => onChange(todayIso())} className="min-h-11 px-2 text-xs text-brand font-semibold shrink-0">
          Today · Hôm nay
        </button>
      )}
      <button
        onClick={() => !isToday && onChange(addDaysIso(date, 1))}
        disabled={isToday}
        className="w-11 h-11 flex items-center justify-center text-brand disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function MoneyInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder="0"
        className="w-28 min-h-11 rounded-xl border-2 border-border px-3 text-right font-bold tabular-nums focus:outline-none focus:border-brand disabled:opacity-50"
      />
      <span className="text-muted text-sm">₫</span>
    </div>
  );
}

/**
 * What the till actually took, above the manual entry.
 *
 * The manual channel entry below stays — Shopee and Grab settle outside the
 * till, and their numbers still arrive by hand. But eat-in money is now the
 * till's own record, so the person cashing up copies these figures instead of
 * reconstructing them from a drawer and memory. Derived live from the orders,
 * never stored: a summary that could drift from its source is worse than none.
 */
function TillCashUp({ date }: { date: string }) {
  const [day, setDay] = useState<ReturnType<typeof cashUpForDate> | null>(null);

  useEffect(() => {
    setDay(cashUpForDate(date));
  }, [date]);

  if (!day) return null;
  if (day.totalVnd === 0 && day.orderCount === 0 && day.stillOpenCount === 0) {
    return null; // The till was not used that day — the manual entry is the whole story.
  }

  return (
    <Card>
      <p className="font-semibold text-sm mb-1">
        From the till <span className="text-muted font-normal">· Từ máy tính tiền</span>
      </p>
      <p className="text-xs text-muted mb-3">
        {day.orderCount} closed orders · {day.orderCount} đơn đã đóng
        {day.stillOpenCount > 0 && (
          <span className="text-warning font-semibold">
            {" "}· {day.stillOpenCount} still open · còn mở
          </span>
        )}
      </p>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        {(
          [
            ["Cash · Tiền mặt", day.totals.cash],
            ["Transfer · CK", day.totals.vietqr],
            ["Card · Thẻ", day.totals.card],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className="rounded-xl border border-border py-2">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="font-bold tabular-nums">{vnd(amount)}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
        <span>Till total · Tổng máy</span>
        <span className="tabular-nums">{vnd(day.totalVnd)}</span>
      </div>

      {day.pending.length > 0 && (
        <p className="text-xs text-warning font-semibold mt-2">
          {day.pending.length} transfer{day.pending.length === 1 ? "" : "s"} still unconfirmed —
          settle before closing · giao dịch chưa xác nhận
        </p>
      )}

      {day.cardPayments.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border space-y-1">
          <p className="text-xs font-semibold text-muted">
            Card payments, one per slip · Thanh toán thẻ
          </p>
          {day.cardPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-muted min-w-0 truncate">
                {p.providerRef || p.reference}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {p.slipPhotoPath && (
                  <button
                    onClick={async () => {
                      const url = await cardSlipUrl(p.slipPhotoPath!);
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    aria-label="View the slip"
                    className="text-brand flex items-center gap-1"
                  >
                    <Eye size={12} /> slip
                  </button>
                )}
                <span className="tabular-nums font-semibold">{vnd(p.amountVnd)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {day.discounts.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border space-y-1">
          <p className="text-xs font-semibold text-muted">
            Discounts given · Giảm giá — {vnd(day.discountVnd)}
          </p>
          {day.discounts.map((d) => (
            <div key={d.orderId} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                <Bi value={d.label} mode="inline" />
                <span className="text-muted"> — {d.appliedBy ?? "?"}</span>
              </span>
              <span className="tabular-nums shrink-0">−{vnd(d.amountVnd)}</span>
            </div>
          ))}
        </div>
      )}

      {day.cancelledCount > 0 && (
        <p className="text-xs text-muted mt-2">
          {day.cancelledCount} order{day.cancelledCount === 1 ? "" : "s"} voided · đơn đã huỷ
        </p>
      )}

      {day.stillOpenCount > 0 && (
        <Link href="/service" className="block text-center text-xs text-brand font-semibold mt-3">
          Close the open tables first · Đóng bàn còn mở trước →
        </Link>
      )}
    </Card>
  );
}

function SalesContent() {
  const { session } = useSession();
  const [date, setDate] = useState(todayIso());
  const [entry, setEntry] = useState<DailySales | null>(null);

  useEffect(() => {
    if (!session) return;
    setEntry(getOrCreateEntry(date, session.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, session?.name]);

  if (!session || !entry) return null;

  const patch = (fields: Partial<Omit<DailySales, "id" | "date" | "enteredBy" | "updatedAt">>) => {
    setEntry(updateEntry(date, fields, session.name));
  };

  const total = totalSalesVnd(entry);
  const zVariance = zReportVarianceVnd(entry);
  const expectedCash = expectedCashVnd(entry);
  const cashVariance = cashVarianceVnd(entry);

  return (
    <div className="pb-6">
      <PageHeader title="Daily Sales · Doanh Thu Hằng Ngày" subtitle="End-of-day entry · Nhập cuối ngày" />
      <DateNav date={date} onChange={setDate} />

      <div className="px-4 md:px-8 space-y-4">
        <TillCashUp date={date} />
        <Card>
          <p className="font-semibold text-sm mb-3">Sales by channel · Doanh thu theo kênh</p>
          <div className="space-y-3">
            {CHANNEL_ORDER.map((c) => (
              <div key={c} className="flex items-center justify-between">
                <span className="text-sm">
                  {CHANNEL_LABEL[c].en} · {CHANNEL_LABEL[c].vi}
                </span>
                <MoneyInput
                  value={entry.channelAmountsVnd[c]}
                  onChange={(v) => patch({ channelAmountsVnd: { ...entry.channelAmountsVnd, [c]: v } })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="font-bold text-sm">Total · Tổng cộng</span>
            <span className="font-bold text-lg text-brand">{vnd(total)}</span>
          </div>
        </Card>

        <Card>
          <p className="font-semibold text-sm mb-3">POS Z-report · Báo cáo Z của POS</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Z-report total · Tổng báo cáo Z</span>
            <MoneyInput
              value={entry.posZReportTotalVnd ?? 0}
              onChange={(v) => patch({ posZReportTotalVnd: v })}
            />
          </div>
          {zVariance !== null && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted">Variance · Chênh lệch</span>
              <Badge tone={zVariance === 0 ? "success" : "danger"}>{vnd(zVariance)}</Badge>
            </div>
          )}
        </Card>

        <Card>
          <p className="font-semibold text-sm mb-3">Cash reconciliation · Đối soát tiền mặt</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Float carried in · Quỹ đầu ca</span>
              <MoneyInput value={entry.floatVnd} onChange={(v) => patch({ floatVnd: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Cash sales · Doanh thu tiền mặt</span>
              <MoneyInput value={entry.cashSalesVnd} onChange={(v) => patch({ cashSalesVnd: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bank drop · Nộp ngân hàng</span>
              <MoneyInput value={entry.bankDropVnd} onChange={(v) => patch({ bankDropVnd: v })} />
            </div>
          </div>
          <input
            value={entry.bankDropNote ?? ""}
            onChange={(e) => patch({ bankDropNote: e.target.value })}
            placeholder="Bank drop note (optional) · Ghi chú nộp ngân hàng"
            className="w-full min-h-11 rounded-xl border-2 border-border px-3 mt-3 text-sm focus:outline-none focus:border-brand"
          />

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted">Expected in drawer · Dự kiến trong ngăn kéo</span>
            <span className="font-bold tabular-nums">{vnd(expectedCash)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm">Cash counted · Tiền mặt đếm được</span>
            <MoneyInput
              value={entry.cashCountedVnd ?? 0}
              onChange={(v) => patch({ cashCountedVnd: v })}
            />
          </div>
          {cashVariance !== null && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted">Variance · Chênh lệch</span>
              <Badge tone={cashVariance === 0 ? "success" : "danger"}>{vnd(cashVariance)}</Badge>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function SalesPage() {
  return (
    <RoleGate module="sales">
      <SalesContent />
    </RoleGate>
  );
}
