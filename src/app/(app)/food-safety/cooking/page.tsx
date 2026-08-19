"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Plus, Pencil, ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getCookLogs, logCookTemp, correctCookTemp, cookDate, isLateCookEntry } from "@/lib/repo/foodSafety";
import type { CookTempRow } from "@/lib/repo/foodSafety";
import { getRecipes } from "@/lib/repo/recipes";
import { getMenuItems } from "@/lib/repo/menu";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { Bi as BiValue } from "@/lib/types";

const DISH_LIST_ID = "cook-dish-names";

/** Dish names the app already holds — recipes first, then any menu item that isn't a recipe. */
function dishNames(): BiValue[] {
  const byName = new Map<string, BiValue>();
  for (const r of getRecipes()) byName.set(r.name.en.toLowerCase(), r.name);
  for (const m of getMenuItems()) if (!byName.has(m.name.en.toLowerCase())) byName.set(m.name.en.toLowerCase(), m.name);
  return Array.from(byName.values()).sort((a, b) => a.en.localeCompare(b.en));
}

/**
 * Picks the day an entry is logged against. Defaults to today; a missed check
 * remembered the next morning can be put on the day it actually happened, and
 * the banner makes that impossible to do by accident. Future dates are blocked.
 */
function LogDateBar({ date, onChange }: { date: string; onChange: (next: string) => void }) {
  const today = todayIso();
  const isToday = date === today;
  return (
    <div className="mb-3">
      <p className="text-xs text-muted mb-1">Log date · Ngày ghi nhận</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(addDaysIso(date, -1))}
          className="w-11 h-11 rounded-xl border-2 border-border flex items-center justify-center shrink-0"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && e.target.value <= today && onChange(e.target.value)}
          className="flex-1 min-h-11 rounded-xl border-2 border-border px-3 text-sm text-center focus:outline-none focus:border-brand"
        />
        <button
          onClick={() => !isToday && onChange(addDaysIso(date, 1))}
          disabled={isToday}
          className="w-11 h-11 rounded-xl border-2 border-border flex items-center justify-center shrink-0 disabled:opacity-40"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {!isToday && (
        <div className="mt-2 rounded-xl border-2 border-warning/40 bg-warning-tint px-3 py-2">
          <div className="flex items-start gap-2 text-xs text-warning">
            <CalendarClock size={16} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">Logging for {date}, not today</p>
              <p>Đang ghi cho ngày {date}, không phải hôm nay</p>
            </div>
          </div>
          <button
            onClick={() => onChange(today)}
            className="mt-2 w-full min-h-11 rounded-xl bg-warning text-white text-xs font-semibold"
          >
            Back to today · Về hôm nay
          </button>
        </div>
      )}
    </div>
  );
}

function CorrectionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: number;
  onSubmit: (probeTempC: number, action?: string) => void;
  onCancel: () => void;
}) {
  const [temp, setTemp] = useState(String(initial));
  const [action, setAction] = useState("");
  const underTarget = temp.trim() !== "" && Number(temp) < 75;

  return (
    <div className="mt-2 p-3 rounded-xl bg-background">
      <p className="text-xs text-muted mb-2">
        The original reading stays on record · Số đo gốc vẫn được lưu
      </p>
      <div className="flex items-center gap-2 mb-2">
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          step="0.1"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          placeholder="°C"
          className="w-24 min-h-12 rounded-xl border-2 border-border px-3 text-base font-bold focus:outline-none focus:border-brand"
        />
        <span className="text-muted text-sm">°C · target ≥75°C / 30s</span>
      </div>
      <input
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder={
          underTarget
            ? "Action taken (required — under target) · Hành động khắc phục"
            : "Corrective action (optional) · Hành động khắc phục"
        }
        className={`w-full min-h-11 rounded-xl border-2 px-3 text-sm mb-2 focus:outline-none ${
          underTarget ? "border-danger/40 focus:border-danger" : "border-border focus:border-brand"
        }`}
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-11" onClick={onCancel}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-11"
          disabled={temp.trim() === "" || (underTarget && !action.trim())}
          onClick={() => onSubmit(Number(temp), action.trim() || undefined)}
        >
          Save · Lưu
        </Button>
      </div>
    </div>
  );
}

function AddForm({ onAdded, staffName }: { onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [dish, setDish] = useState("");
  const [batch, setBatch] = useState("");
  const [temp, setTemp] = useState("");
  const [action, setAction] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a batch · Ghi mẻ nấu
      </button>
    );
  }

  const reset = () => {
    setDate(todayIso());
    setDish("");
    setBatch("");
    setTemp("");
    setAction("");
    setOpen(false);
  };

  const underTarget = temp.trim() !== "" && Number(temp) < 75;

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New cook temp log · Ghi nhiệt độ nấu mới</p>
      <LogDateBar date={date} onChange={setDate} />
      <input
        value={dish}
        onChange={(e) => setDish(e.target.value)}
        placeholder="Dish · Món ăn (e.g. Jerk Chicken)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
        list={DISH_LIST_ID}
      />
      <input
        value={batch}
        onChange={(e) => setBatch(e.target.value)}
        placeholder="Batch label · Mẻ (e.g. Lunch batch 1)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          placeholder="Probe · Đo"
          className="w-32 min-h-12 rounded-xl border-2 border-border px-3 text-sm font-bold focus:outline-none focus:border-brand"
        />
        <span className="text-muted text-sm">°C · target ≥75°C / 30s</span>
      </div>
      {underTarget && (
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action taken (required — under target) · Hành động khắc phục"
          className="w-full min-h-12 rounded-xl border-2 border-danger/40 px-3 mb-3 text-sm focus:outline-none focus:border-danger"
        />
      )}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!dish.trim() || !batch.trim() || temp.trim() === "" || (underTarget && !action.trim())}
          onClick={() => {
            logCookTemp(date, dish.trim(), batch.trim(), Number(temp), staffName, underTarget ? action.trim() : undefined);
            reset();
            onAdded();
          }}
        >
          Save · Lưu
        </Button>
      </div>
    </Card>
  );
}

function LogCard({
  log,
  canEnter,
  staffName,
  onChanged,
}: {
  log: CookTempRow;
  canEnter: boolean;
  staffName: string;
  onChanged: () => void;
}) {
  const [correcting, setCorrecting] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{log.dish}</p>
          <p className="text-xs text-muted">
            {log.batchLabel} · {log.loggedBy} · cooked {cookDate(log)}
          </p>
          <p className="text-[11px] text-muted">Logged {new Date(log.loggedAt).toLocaleString()}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold">{log.probeTempC}°C</p>
          {log.targetMet ? (
            <Badge tone="success">
              <CheckCircle2 size={12} /> Target met
            </Badge>
          ) : (
            <Badge tone="danger">
              <AlertTriangle size={12} /> Under target
            </Badge>
          )}
        </div>
      </div>
      {isLateCookEntry(log) && (
        <p className="text-[11px] text-warning font-semibold mt-1">
          Late entry · Ghi muộn
        </p>
      )}
      {log.correctionOfId && (
        <p className="text-[11px] text-muted mt-1">Correction of an earlier entry · Sửa của mục trước</p>
      )}
      {log.correctiveAction && <p className="text-xs text-danger mt-2">Action: {log.correctiveAction}</p>}
      {canEnter && !correcting && (
        <button
          onClick={() => setCorrecting(true)}
          className="mt-2 min-h-11 flex items-center gap-1 text-xs text-brand font-semibold"
        >
          <Pencil size={12} /> Correct · Sửa
        </button>
      )}
      {correcting && (
        <CorrectionForm
          initial={log.probeTempC}
          onCancel={() => setCorrecting(false)}
          onSubmit={(probeTempC, action) => {
            correctCookTemp(log.id, probeTempC, staffName, action);
            setCorrecting(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function CookingContent() {
  const { session } = useSession();
  const [logs, setLogs] = useState<CookTempRow[]>([]);
  const [dishes, setDishes] = useState<BiValue[]>([]);
  const refresh = () => setLogs(getCookLogs());

  useEffect(() => {
    refresh();
    setDishes(dishNames());
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "cooking");

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Cooking / Core Temp · Nhiệt Độ Nấu / Lõi"
        subtitle="Probe every batch · Đo mỗi mẻ nấu"
      />
      <div className="px-4 md:px-8">
        {canEnter && <AddForm onAdded={refresh} staffName={session.name} />}
        <datalist id={DISH_LIST_ID}>
          {dishes.map((d) => (
            <option key={d.en} value={d.en}>
              {d.vi}
            </option>
          ))}
        </datalist>
        <div className="space-y-2">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} canEnter={canEnter} staffName={session.name} onChanged={refresh} />
          ))}
          {logs.length === 0 && <p className="text-muted text-center py-10 text-sm">No entries yet · Chưa có mục nào</p>}
        </div>
      </div>
    </div>
  );
}

export default function CookingPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="cooking">
        <CookingContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
