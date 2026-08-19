"use client";

import { useEffect, useState } from "react";
import { PackageSearch, CheckCircle2, Users, ChevronRight, Printer } from "lucide-react";
import Link from "next/link";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { useSession } from "@/lib/auth/RoleContext";
import { canConfirmPlanner } from "@/lib/auth/permissions";
import { getStockItems } from "@/lib/repo/stock";
import {
  getOrSuggestDecision,
  confirmDecision,
  getReorderFlags,
  getIngredientForecast,
  type ReorderFlag,
  type IngredientForecastRow,
} from "@/lib/repo/planner";
import { getBookedCoversForDate } from "@/lib/bookings/repo";
import { supabaseConfigured } from "@/lib/supabase/client";
import { formatQty } from "@/lib/scale";
import { todayIso } from "@/lib/storage";
import type { StockItem, PlannerDecision } from "@/lib/types";

function PlannerRow({
  item,
  date,
  canConfirm,
  enteredBy,
  onChanged,
}: {
  item: StockItem;
  date: string;
  canConfirm: boolean;
  enteredBy: string;
  onChanged: () => void;
}) {
  const [decision, setDecision] = useState<PlannerDecision | null>(null);

  useEffect(() => {
    setDecision(getOrSuggestDecision(item.id, date));
  }, [item.id, date]);

  if (!decision) return null;

  const qty = decision.confirmedQty ?? decision.suggestedQty;
  const isConfirmed = decision.confirmedQty !== null;

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <Bi value={item.name} className="font-semibold text-sm" mode="inline" />
        <p className="text-xs text-muted mt-1 print:hidden">
          Suggested · Gợi ý: {decision.suggestedQty} {item.unit}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 print:hidden">
        <Stepper
          value={qty}
          disabled={!canConfirm}
          onChange={(v) => {
            const updated = confirmDecision(item.id, date, v, enteredBy);
            setDecision(updated);
            onChanged();
          }}
          size="sm"
        />
        {isConfirmed && <CheckCircle2 size={18} className="text-success" />}
      </div>
      <p className="hidden print:block font-semibold text-sm tabular-nums shrink-0">
        {qty} {item.unit} {isConfirmed ? "✓" : "(suggested)"}
      </p>
    </Card>
  );
}

function ReorderFlags({ flags }: { flags: ReorderFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <Card className="mb-4 border-warning/40 bg-warning-tint">
      <p className="font-semibold text-sm text-warning flex items-center gap-2 mb-2">
        <PackageSearch size={18} /> Due for reorder · Cần đặt hàng thêm
      </p>
      <div className="space-y-1">
        {flags.map((f) => (
          <div key={f.itemId} className="flex justify-between text-sm">
            <Bi value={f.name} mode="inline" />
            <span className="font-semibold tabular-nums">
              {f.onHand}/{f.par} {f.unit}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BookedCoversBanner({ date }: { date: string }) {
  const [covers, setCovers] = useState<{ covers: number; bookingCount: number } | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    getBookedCoversForDate(date)
      .then(setCovers)
      .catch(() => setCovers(null));
  }, [date]);

  if (!covers || covers.bookingCount === 0) return null;

  return (
    <Link href="/bookings">
      <Card className="mb-4 border-brand/30 flex items-center gap-3">
        <Users size={20} className="text-brand shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-brand">
            {covers.covers} booked cover{covers.covers > 1 ? "s" : ""} today · {covers.bookingCount} reservation{covers.bookingCount > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted">Reservations only — walk-ins are on top of this · Chỉ tính khách đặt trước</p>
        </div>
        <ChevronRight size={18} className="text-brand shrink-0" />
      </Card>
    </Link>
  );
}

function IngredientForecastCard({ rows }: { rows: IngredientForecastRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-1">Ingredients needed today · Nguyên liệu cần hôm nay</p>
      <p className="text-xs text-muted mb-3">
        Scaled from the quantities below — adjust a dish and this updates · Tính từ số lượng bên dưới
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={`${r.name.en}-${r.unit}`} className="flex items-center justify-between text-sm">
            <Bi value={r.name} mode="inline" />
            <span className="font-semibold tabular-nums shrink-0 ml-2">
              {formatQty(r.qty)} {r.unit}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlannerPageContent() {
  const { session } = useSession();
  const date = todayIso();
  const [items, setItems] = useState<StockItem[]>([]);
  const [flags, setFlags] = useState<ReorderFlag[]>([]);
  const [forecast, setForecast] = useState<IngredientForecastRow[]>([]);

  const refreshForecast = () => setForecast(getIngredientForecast(date));

  useEffect(() => {
    setItems(getStockItems("kitchen"));
    setFlags(getReorderFlags(date));
    refreshForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!session) return null;
  const canConfirm = canConfirmPlanner(session.role);

  return (
    <div className="pb-6">
      <PageHeader
        title="Production Planner · Kế Hoạch Sản Xuất"
        subtitle="Confirm or override today's prep quantities · Xác nhận hoặc điều chỉnh số lượng chuẩn bị"
        action={
          <Button variant="ghost" className="min-h-11 px-3 print:hidden" onClick={() => window.print()}>
            <Printer size={16} />
          </Button>
        }
      />
      <div className="px-4 md:px-8">
        <p className="hidden print:block font-bold text-sm mb-3">Production Planner · {date}</p>
        <div className="print:hidden">
          <BookedCoversBanner date={date} />
        </div>
        <ReorderFlags flags={flags} />
        <IngredientForecastCard rows={forecast} />
        <div className="space-y-3">
          {items.map((item) => (
            <PlannerRow key={item.id} item={item} date={date} canConfirm={canConfirm} enteredBy={session.name} onChanged={refreshForecast} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  return (
    <RoleGate module="planner">
      <PlannerPageContent />
    </RoleGate>
  );
}
