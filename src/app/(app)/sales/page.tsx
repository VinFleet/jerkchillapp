"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { getOrCreateEntry, updateEntry, totalSalesVnd, expectedCashVnd, cashVarianceVnd, zReportVarianceVnd } from "@/lib/repo/sales";
import { todayIso } from "@/lib/storage";
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

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === todayIso();
  return (
    <div className="flex items-center gap-2 px-4 md:px-8 mb-4">
      <button onClick={() => onChange(shiftDate(date, -1))} className="p-2 text-brand" aria-label="Previous day">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {date} {isToday && <span className="text-brand">· Today / Hôm nay</span>}
      </span>
      <button
        onClick={() => !isToday && onChange(shiftDate(date, 1))}
        disabled={isToday}
        className="p-2 text-brand disabled:opacity-30"
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
