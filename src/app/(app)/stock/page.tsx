"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditStockSection, canSeeCostMargin } from "@/lib/auth/permissions";
import {
  getStockItems,
  getOrCreateEntry,
  updateEntry,
  getWasteStreak,
  logWaste,
  getWasteForDate,
  wasteTotalVnd,
} from "@/lib/repo/stock";
import { suggestQuantity } from "@/lib/repo/planner";
import { getSettings } from "@/lib/repo/settings";
import { todayIso, addDaysIso } from "@/lib/storage";
import { WASTE_REASON_LABEL, WASTE_REASON_ORDER } from "@/lib/wasteLabels";
import type { StockDayEntry, StockItem, StockSection, PrepCategory, WasteLogEntry, WasteReason } from "@/lib/types";

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

const PREP_CATEGORY_LABEL: Record<PrepCategory, { en: string; vi: string }> = {
  main: { en: "Mains", vi: "Món chính" },
  side: { en: "Sides", vi: "Món phụ" },
  dessert: { en: "Desserts", vi: "Tráng miệng" },
};

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === todayIso();
  return (
    <div className="flex items-center gap-2 px-4 md:px-8">
      <button onClick={() => onChange(addDaysIso(date, -1))} className="p-2 text-brand" aria-label="Previous day">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {date} {isToday && <span className="text-brand">· Today / Hôm nay</span>}
      </span>
      <button
        onClick={() => !isToday && onChange(addDaysIso(date, 1))}
        disabled={isToday}
        className="p-2 text-brand disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function WasteButton({
  item,
  date,
  loggedBy,
  canEdit,
  showCost,
  onLogged,
}: {
  item: StockItem;
  date: string;
  loggedBy: string;
  canEdit: boolean;
  showCost: boolean;
  onLogged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<WasteReason>("over_prepped");
  const [entries, setEntries] = useState<WasteLogEntry[]>([]);

  const refresh = () => setEntries(getWasteForDate(date).filter((w) => w.itemId === item.id));
  useEffect(refresh, [item.id, date]);

  const totalQty = entries.reduce((sum, w) => sum + w.qty, 0);
  const totalCost = wasteTotalVnd(entries);

  const summary = totalQty > 0 && (
    <p className="text-xs text-danger">
      {totalQty} {item.unit} wasted today · Hao hụt hôm nay
      {showCost && totalCost > 0 ? ` · ${vnd(totalCost)}` : ""}
    </p>
  );

  if (!canEdit) {
    return summary ? <div className="mt-3 pt-3 border-t border-border">{summary}</div> : null;
  }

  if (open) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs font-semibold text-muted mb-2">Log waste · Ghi nhận hao hụt</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted">Qty · Số lượng</span>
          <Stepper value={qty} onChange={setQty} min={1} />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {WASTE_REASON_ORDER.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border-2 ${
                reason === r ? "bg-danger/10 text-danger border-danger" : "border-border text-muted"
              }`}
            >
              {WASTE_REASON_LABEL[r].en} · {WASTE_REASON_LABEL[r].vi}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 min-h-10 text-sm" onClick={() => setOpen(false)}>
            Cancel · Hủy
          </Button>
          <Button
            className="flex-1 min-h-10 text-sm"
            onClick={() => {
              logWaste(item.id, date, qty, reason, loggedBy);
              setQty(1);
              setReason("over_prepped");
              setOpen(false);
              refresh();
              onLogged();
            }}
          >
            Save · Lưu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
      <div>{summary}</div>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-danger shrink-0">
        <Trash2 size={12} /> Log waste · Ghi hao hụt
      </button>
    </div>
  );
}

function LogRow({
  item,
  date,
  enteredBy,
  canEdit,
  showCost,
  producedLabel,
  onWasteLogged,
}: {
  item: StockItem;
  date: string;
  enteredBy: string;
  canEdit: boolean;
  showCost: boolean;
  producedLabel: { en: string; vi: string };
  onWasteLogged: () => void;
}) {
  const [entry, setEntry] = useState<StockDayEntry | null>(null);
  const [wasteStreak, setWasteStreak] = useState(0);

  useEffect(() => {
    setEntry(getOrCreateEntry(item.id, date, enteredBy));
    setWasteStreak(getWasteStreak(item.id, date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, date]);

  if (!entry) return null;

  const patch = (fields: Partial<Pick<StockDayEntry, "produced" | "closing">>) => {
    const updated = updateEntry(item.id, date, fields, enteredBy);
    setEntry(updated);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <Bi value={item.name} className="font-semibold text-sm" mode="inline" />
        {wasteStreak >= 3 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-warning shrink-0 ml-2">
            <AlertTriangle size={14} /> {wasteStreak} nights left over
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-muted">Opening · Đầu ngày</span>
        <span className="text-right">
          <span className="font-bold tabular-nums">{entry.opening}</span>
          {/* Says out loud that this number was assumed, not counted — it
              drives today's production plan, so a silent 0 misleads. */}
          {entry.openingUncounted && (
            <span className="block text-[11px] text-warning font-semibold">
              Assumed — not counted last night · Ước tính — tối qua chưa đếm
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">
          {producedLabel.en} · {producedLabel.vi}
        </span>
        <Stepper
          value={entry.produced}
          onChange={(v) => patch({ produced: v })}
          disabled={!canEdit}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          Closing · Cuối ngày
          {entry.closing === null && (
            <span className="block text-[11px] text-warning font-semibold">Not counted yet · Chưa đếm</span>
          )}
        </span>
        <Stepper
          value={entry.closing ?? 0}
          onChange={(v) => patch({ closing: v })}
          disabled={!canEdit}
        />
      </div>
      <WasteButton item={item} date={date} loggedBy={enteredBy} canEdit={canEdit} showCost={showCost} onLogged={onWasteLogged} />
    </Card>
  );
}

function PrepView({ items, date }: { items: StockItem[]; date: string }) {
  const rows = items.map((item) => {
    const entry = getOrCreateEntry(item.id, date, "system");
    const readyNow = entry.opening + entry.produced;
    const parTomorrow = suggestQuantity(item.id, date);
    const toPrep = Math.max(0, parTomorrow - readyNow);
    return { item, readyNow, parTomorrow, toPrep };
  });

  const grouped: [PrepCategory, typeof rows][] = (["main", "side", "dessert"] as PrepCategory[])
    .map((cat) => [cat, rows.filter((r) => r.item.prepCategory === cat)] as [PrepCategory, typeof rows])
    .filter(([, r]) => r.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map(([cat, catRows]) => (
        <div key={cat}>
          <h3 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
            {PREP_CATEGORY_LABEL[cat].en} · {PREP_CATEGORY_LABEL[cat].vi}
          </h3>
          <Card className="p-0 divide-y divide-border">
            <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-muted font-semibold">
              <span className="col-span-2">Item · Món</span>
              <span className="text-center">Ready · Có sẵn</span>
              <span className="text-center">To Prep · Cần làm</span>
            </div>
            {catRows.map(({ item, readyNow, parTomorrow, toPrep }) => (
              <div key={item.id} className="grid grid-cols-4 gap-2 px-4 py-3 items-center">
                <Bi value={item.name} className="col-span-2 text-sm" mode="inline" />
                <span className="text-center font-bold tabular-nums">{readyNow}</span>
                <span
                  className={`text-center font-bold tabular-nums ${
                    toPrep > 0 ? "text-warning" : "text-success"
                  }`}
                >
                  {toPrep}
                </span>
                <span className="col-span-4 text-xs text-muted -mt-1">
                  Par tomorrow · Định mức ngày mai: {parTomorrow}
                </span>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function ParTracker({ items, date }: { items: StockItem[]; date: string }) {
  return (
    <Card className="p-0 divide-y divide-border">
      <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-muted font-semibold">
        <span className="col-span-2">Item · Mặt hàng</span>
        <span className="text-center">On Hand · Tồn</span>
        <span className="text-center">Par · Định mức</span>
      </div>
      {items.map((item) => {
        const entry = getOrCreateEntry(item.id, date, "system");
        const onHand = entry.closing ?? entry.opening + entry.produced;
        const par = item.par ?? 0;
        const short = onHand < par;
        return (
          <div key={item.id} className="grid grid-cols-4 gap-2 px-4 py-3 items-center">
            <Bi value={item.name} className="col-span-2 text-sm" mode="inline" />
            <span className={`text-center font-bold tabular-nums ${short ? "text-danger" : ""}`}>
              {onHand}
            </span>
            <span className="text-center tabular-nums text-muted">{par}</span>
            {short && (
              <span className="col-span-4 text-xs font-semibold text-danger -mt-1">
                Below par — to order · Dưới định mức — cần đặt hàng
              </span>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function WasteSummary({ items, date, showCost }: { items: StockItem[]; date: string; showCost: boolean }) {
  const [entries, setEntries] = useState<WasteLogEntry[]>([]);

  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    setEntries(getWasteForDate(date).filter((w) => ids.has(w.itemId)));
  }, [items, date]);

  if (entries.length === 0) return null;
  const totalCost = wasteTotalVnd(entries);

  return (
    <Card className="mb-4 border-danger/30 bg-danger/5">
      <p className="font-semibold text-sm text-danger flex items-center gap-2 mb-1">
        <Trash2 size={16} /> Waste logged today · Hao hụt đã ghi hôm nay
      </p>
      <p className="text-sm">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
        {showCost && totalCost > 0 ? ` · ${vnd(totalCost)}` : ""}
      </p>
    </Card>
  );
}

function StockPageContent() {
  const { session } = useSession();
  const [items, setItems] = useState<StockItem[]>([]);
  const [date, setDate] = useState(todayIso());
  const [section, setSection] = useState<StockSection>("kitchen");
  const [view, setView] = useState<"log" | "secondary">("log");
  const [wasteRefreshKey, setWasteRefreshKey] = useState(0);

  useEffect(() => {
    setItems(getStockItems());
  }, []);

  const availableSections = useMemo<StockSection[]>(() => {
    if (!session) return [];
    if (session.role === "owner" || session.role === "manager") return ["kitchen", "bar"];
    if (session.role === "chef") return ["kitchen"];
    return ["bar"];
  }, [session]);

  useEffect(() => {
    if (availableSections.length && !availableSections.includes(section)) {
      setSection(availableSections[0]);
    }
  }, [availableSections, section]);

  if (!session) return null;

  const sectionItems = items.filter((i) => i.section === section);
  const canEdit = canEditStockSection(session.role, section);
  const showCost = canSeeCostMargin(session.role, getSettings());
  const secondaryLabel =
    section === "kitchen" ? { en: "Prep View", vi: "Xem chuẩn bị" } : { en: "Par Tracker", vi: "Theo dõi định mức" };

  return (
    <div className="pb-6">
      <PageHeader
        title="Stock & Production · Tồn Kho & Sản Xuất"
        subtitle="Opening / Produced / Closing — carried over automatically · Tự động chuyển từ hôm trước"
      />

      <div className="px-4 md:px-8 flex gap-2 mb-3">
        {availableSections.length > 1 &&
          availableSections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`flex-1 min-h-12 rounded-xl font-semibold text-sm border-2 ${
                section === s ? "bg-brand text-white border-brand" : "border-border text-foreground"
              }`}
            >
              {s === "kitchen" ? "Kitchen · Bếp" : "Bar · Quầy bar"}
            </button>
          ))}
      </div>

      <div className="px-4 md:px-8 flex gap-2 mb-4">
        <button
          onClick={() => setView("log")}
          className={`flex-1 min-h-11 rounded-full font-semibold text-sm border-2 ${
            view === "log" ? "bg-brand-light text-brand border-brand" : "border-border text-muted"
          }`}
        >
          Daily Log · Nhật ký
        </button>
        <button
          onClick={() => setView("secondary")}
          className={`flex-1 min-h-11 rounded-full font-semibold text-sm border-2 ${
            view === "secondary" ? "bg-brand-light text-brand border-brand" : "border-border text-muted"
          }`}
        >
          {secondaryLabel.en} · {secondaryLabel.vi}
        </button>
      </div>

      {view === "log" && <DateNav date={date} onChange={setDate} />}

      <div className="px-4 md:px-8 mt-4 space-y-3">
        {view === "log" && <WasteSummary key={wasteRefreshKey} items={sectionItems} date={date} showCost={showCost} />}
        {view === "log" &&
          sectionItems.map((item) => (
            <LogRow
              key={item.id}
              item={item}
              date={date}
              enteredBy={session.name}
              canEdit={canEdit}
              showCost={showCost}
              producedLabel={section === "kitchen" ? { en: "Produced", vi: "Đã làm" } : { en: "Received", vi: "Nhập thêm" }}
              onWasteLogged={() => setWasteRefreshKey((k) => k + 1)}
            />
          ))}

        {view === "secondary" && section === "kitchen" && <PrepView items={sectionItems} date={todayIso()} />}
        {view === "secondary" && section === "bar" && <ParTracker items={sectionItems} date={todayIso()} />}
      </div>
    </div>
  );
}

export default function StockPage() {
  return (
    <RoleGate module="stock">
      <StockPageContent />
    </RoleGate>
  );
}
