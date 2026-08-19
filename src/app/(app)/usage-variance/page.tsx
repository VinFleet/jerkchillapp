"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { getStockItems } from "@/lib/repo/stock";
import { getSalesCount, setSalesCount, getVarianceForDate } from "@/lib/repo/usageVariance";
import { todayIso } from "@/lib/storage";
import type { StockItem } from "@/lib/types";
import type { VarianceRow } from "@/lib/repo/usageVariance";

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

function SoldInput({ stockItemId, date, staffName, onSaved }: { stockItemId: string; date: string; staffName: string; onSaved: () => void }) {
  const [value, setValue] = useState(String(getSalesCount(stockItemId, date)?.qtySold ?? ""));

  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setSalesCount(stockItemId, date, Number(value) || 0, staffName);
        onSaved();
      }}
      placeholder="0"
      className="w-16 min-h-9 rounded-lg border-2 border-border px-2 text-sm font-bold text-center tabular-nums"
    />
  );
}

function UsageVarianceContent() {
  const { session } = useSession();
  const [date, setDate] = useState(todayIso());
  const [items, setItems] = useState<StockItem[]>([]);
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [, setRefreshKey] = useState(0);

  useEffect(() => {
    setItems(getStockItems("kitchen").filter((i) => i.prepCategory));
  }, []);

  useEffect(() => {
    setRows(getVarianceForDate(date));
  }, [date]);

  if (!session) return null;
  const refresh = () => {
    setRows(getVarianceForDate(date));
    setRefreshKey((k) => k + 1);
  };
  const rowFor = (id: string) => rows.find((r) => r.stockItemId === id);

  return (
    <div className="pb-6">
      <PageHeader
        title="Usage Variance · Chênh Lệch Sử Dụng"
        subtitle="Units sold vs. stock log usage · Số bán ra so với tồn kho"
      />
      <DateNav date={date} onChange={setDate} />
      <div className="px-4 md:px-8 space-y-2">
        <div className="grid grid-cols-4 gap-2 px-1 text-xs text-muted font-semibold">
          <span className="col-span-2">Item</span>
          <span className="text-center">Sold</span>
          <span className="text-center">Used</span>
        </div>
        {items.map((item) => {
          const row = rowFor(item.id);
          const variance = row?.variance ?? 0;
          return (
            <Card key={item.id}>
              <div className="grid grid-cols-4 gap-2 items-center">
                <Bi value={item.name} className="col-span-2 text-sm" mode="inline" />
                <div className="text-center">
                  <SoldInput stockItemId={item.id} date={date} staffName={session.name} onSaved={refresh} />
                </div>
                <div className="text-center">
                  <span className="font-bold tabular-nums text-sm">{row?.actual ?? 0}</span>
                </div>
              </div>
              {variance !== 0 && (
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted">Variance · Chênh lệch</span>
                  <Badge tone={variance > 0 ? "warning" : "muted"}>
                    {variance > 0 && <AlertTriangle size={12} />}
                    {variance > 0 ? `+${variance}` : variance} {item.unit}
                  </Badge>
                </div>
              )}
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-muted text-center py-10 text-sm">No kitchen prep items to compare · Không có món để so sánh</p>}
      </div>
    </div>
  );
}

export default function UsageVariancePage() {
  return (
    <RoleGate module="usageVariance">
      <UsageVarianceContent />
    </RoleGate>
  );
}
