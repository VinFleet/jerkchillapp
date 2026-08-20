"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PassFail } from "@/components/ui/PassFail";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getInspectionsForDate, logBeforePrep, logDuringPrep, logBeforeServing, inspectionPassed } from "@/lib/repo/foodSafety";
import { getRecipes } from "@/lib/repo/recipes";
import { getMenuItems } from "@/lib/repo/menu";
import { getSuppliers } from "@/lib/repo/suppliers";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { Bi as BiValue, ThreeStepInspection, InspectionStage, ServicePeriod } from "@/lib/types";

const STAGE_LABEL: Record<InspectionStage, { en: string; vi: string }> = {
  before: { en: "Step 1 — Before preparation", vi: "Bước 1 — Trước khi chế biến" },
  during: { en: "Step 2 — During preparation", vi: "Bước 2 — Trong khi chế biến" },
  before_serving: { en: "Step 3 — Before serving", vi: "Bước 3 — Trước khi phục vụ" },
};

/** Short form for the step switcher, where three labels share one phone-width row. */
const STAGE_SHORT: Record<InspectionStage, BiValue> = {
  before: { en: "Before prep", vi: "Trước chế biến" },
  during: { en: "During prep", vi: "Trong chế biến" },
  before_serving: { en: "Before serving", vi: "Trước phục vụ" },
};

const STAGE_ORDER: InspectionStage[] = ["before", "during", "before_serving"];

const DISH_LIST_ID = "insp-dish-names";
const INGREDIENT_LIST_ID = "insp-ingredient-names";
const SUPPLIER_LIST_ID = "insp-supplier-names";

function sortedBi(byName: Map<string, BiValue>): BiValue[] {
  return Array.from(byName.values()).sort((a, b) => a.en.localeCompare(b.en));
}

/** Dish names the app already holds — recipes first, then any menu item that isn't a recipe. */
function dishNames(): BiValue[] {
  const byName = new Map<string, BiValue>();
  for (const r of getRecipes()) byName.set(r.name.en.toLowerCase(), r.name);
  for (const m of getMenuItems()) if (!byName.has(m.name.en.toLowerCase())) byName.set(m.name.en.toLowerCase(), m.name);
  return sortedBi(byName);
}

/** Every ingredient named across the recipe book. */
function ingredientNames(): BiValue[] {
  const byName = new Map<string, BiValue>();
  for (const r of getRecipes()) for (const i of r.ingredients) byName.set(i.name.en.toLowerCase(), i.name);
  return sortedBi(byName);
}

/**
 * Picks the day checks are viewed and logged against. Defaults to today; a
 * check that was missed and written up the next morning can be put on the day
 * it actually happened, and the banner makes that impossible to do by accident.
 * Future dates are blocked.
 */
function LogDateBar({ date, onChange }: { date: string; onChange: (next: string) => void }) {
  const today = todayIso();
  const isToday = date === today;
  return (
    <div className="mb-4">
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

function EntryList({ entries }: { entries: ThreeStepInspection[] }) {
  if (entries.length === 0) return <p className="text-xs text-muted">No checks logged yet · Chưa có lần kiểm tra</p>;
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const pass = inspectionPassed(e);
        return (
          <div key={e.id} className="text-xs border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{e.meal}</span>
              <Badge tone={pass ? "success" : "danger"}>
                {pass ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {pass ? "Pass" : "Fail"}
              </Badge>
            </div>
            {e.stage === "before" && (
              <p className="text-muted">
                {e.ingredient} · {e.supplierSource} · {e.qty}
              </p>
            )}
            {e.stage === "during" && (
              <p className="text-muted">
                {e.startTime}–{e.endTime} · area {e.areaHygieneOk ? "OK" : "FAIL"} · staff {e.staffHygieneOk ? "OK" : "FAIL"}
              </p>
            )}
            {e.stage === "before_serving" && (
              <p className="text-muted">
                {e.dish} · served {e.timeServed}
              </p>
            )}
            {e.notes && <p className="text-muted">{e.notes}</p>}
            <p className="text-muted">
              {e.checkedBy} · {new Date(e.checkedAt).toLocaleTimeString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Says out loud what a greyed-out Save is still waiting for. A disabled button
 * with no reason attached is a dead end for anyone who doesn't already know
 * which fields this form treats as required.
 */
function MissingHint({ missing }: { missing: BiValue[] }) {
  if (missing.length === 0) return null;
  return (
    <p className="text-xs text-warning text-center leading-snug">
      Still needed: {missing.map((m) => m.en).join(", ")}
      <br />
      Còn thiếu: {missing.map((m) => m.vi).join(", ")}
    </p>
  );
}

/**
 * The three steps are legally distinct records with their own Save — a chef who
 * only does the before-prep check still files a complete entry. `meal` is the
 * one field they share, so it's entered once per service upstream and passed in.
 */
type StageFormProps = {
  date: string;
  service: ServicePeriod;
  meal: string;
  staffName: string;
  onLogged: () => void;
};

const MEAL_MISSING: BiValue = { en: "meal", vi: "bữa ăn" };

function BeforePrepForm({ date, service, meal, staffName, onLogged }: StageFormProps) {
  const [ingredient, setIngredient] = useState("");
  const [supplierSource, setSupplierSource] = useState("");
  const [qty, setQty] = useState("");
  const [sensoryOk, setSensoryOk] = useState<boolean | undefined>(undefined);
  const [notes, setNotes] = useState("");

  const reset = () => {
    setIngredient("");
    setSupplierSource("");
    setQty("");
    setSensoryOk(undefined);
    setNotes("");
  };

  const missing: BiValue[] = [
    ...(!meal.trim() ? [MEAL_MISSING] : []),
    ...(!ingredient.trim() ? [{ en: "ingredient", vi: "nguyên liệu" }] : []),
    ...(!qty.trim() ? [{ en: "quantity", vi: "số lượng" }] : []),
    ...(sensoryOk === undefined ? [{ en: "sensory check", vi: "kiểm tra cảm quan" }] : []),
  ];

  return (
    <div className="space-y-2">
      <input value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Ingredient · Nguyên liệu" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" list={INGREDIENT_LIST_ID} />
      <input value={supplierSource} onChange={(e) => setSupplierSource(e.target.value)} placeholder="Supplier / source · Nhà cung cấp / nguồn gốc" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" list={SUPPLIER_LIST_ID} />
      <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal"
        placeholder="Qty · Số lượng" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <PassFail label={{ en: "Sensory check", vi: "Kiểm tra cảm quan" }} value={sensoryOk} onChange={setSensoryOk} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) · Ghi chú" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <Button
        className="w-full"
        disabled={missing.length > 0}
        onClick={() => {
          logBeforePrep({ date, service, meal: meal.trim(), ingredient: ingredient.trim(), supplierSource: supplierSource.trim(), qty: qty.trim(), sensoryOk: sensoryOk === true, checkedBy: staffName, notes: notes.trim() || undefined });
          reset();
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
      <MissingHint missing={missing} />
    </div>
  );
}

function DuringPrepForm({ date, service, meal, staffName, onLogged }: StageFormProps) {
  const [areaHygieneOk, setAreaHygieneOk] = useState<boolean | undefined>(undefined);
  const [staffHygieneOk, setStaffHygieneOk] = useState<boolean | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setAreaHygieneOk(undefined);
    setStaffHygieneOk(undefined);
    setStartTime("");
    setEndTime("");
    setNotes("");
  };

  const missing: BiValue[] = [
    ...(!meal.trim() ? [MEAL_MISSING] : []),
    ...(!startTime ? [{ en: "start time", vi: "giờ bắt đầu" }] : []),
    ...(!endTime ? [{ en: "end time", vi: "giờ kết thúc" }] : []),
    ...(areaHygieneOk === undefined ? [{ en: "area hygiene", vi: "vệ sinh khu vực" }] : []),
    ...(staffHygieneOk === undefined ? [{ en: "staff hygiene", vi: "vệ sinh nhân viên" }] : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-xs text-muted mb-1">Start · Bắt đầu</p>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted mb-1">End · Kết thúc</p>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
        </div>
      </div>
      <PassFail label={{ en: "Area / equipment hygiene", vi: "Vệ sinh khu vực / thiết bị" }} value={areaHygieneOk} onChange={setAreaHygieneOk} />
      <PassFail label={{ en: "Staff hygiene", vi: "Vệ sinh nhân viên" }} value={staffHygieneOk} onChange={setStaffHygieneOk} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) · Ghi chú" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <Button
        className="w-full"
        disabled={missing.length > 0}
        onClick={() => {
          logDuringPrep({ date, service, meal: meal.trim(), areaHygieneOk: areaHygieneOk === true, staffHygieneOk: staffHygieneOk === true, startTime, endTime, checkedBy: staffName, notes: notes.trim() || undefined });
          reset();
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
      <MissingHint missing={missing} />
    </div>
  );
}

function BeforeServingForm({ date, service, meal, staffName, onLogged }: StageFormProps) {
  const [dish, setDish] = useState("");
  const [sensoryOk, setSensoryOk] = useState<boolean | undefined>(undefined);
  const [timeServed, setTimeServed] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setDish("");
    setSensoryOk(undefined);
    setTimeServed("");
    setNotes("");
  };

  const missing: BiValue[] = [
    ...(!meal.trim() ? [MEAL_MISSING] : []),
    ...(!dish.trim() ? [{ en: "dish", vi: "món ăn" }] : []),
    ...(!timeServed ? [{ en: "time served", vi: "giờ phục vụ" }] : []),
    ...(sensoryOk === undefined ? [{ en: "sensory check", vi: "kiểm tra cảm quan" }] : []),
  ];

  return (
    <div className="space-y-2">
      <input value={dish} onChange={(e) => setDish(e.target.value)} placeholder="Dish · Món ăn" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" list={DISH_LIST_ID} />
      <div>
        <p className="text-xs text-muted mb-1">Time served · Giờ phục vụ</p>
        <input type="time" value={timeServed} onChange={(e) => setTimeServed(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      </div>
      <PassFail label={{ en: "Sensory check", vi: "Kiểm tra cảm quan" }} value={sensoryOk} onChange={setSensoryOk} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) · Ghi chú" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <Button
        className="w-full"
        disabled={missing.length > 0}
        onClick={() => {
          logBeforeServing({ date, service, meal: meal.trim(), dish: dish.trim(), sensoryOk: sensoryOk === true, timeServed, checkedBy: staffName, notes: notes.trim() || undefined });
          reset();
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
      <MissingHint missing={missing} />
    </div>
  );
}

function InspectionsContent() {
  const { session } = useSession();
  const [date, setDate] = useState(todayIso());
  const [service, setService] = useState<ServicePeriod>("lunch");
  const [stage, setStage] = useState<InspectionStage>("before");
  const [meal, setMeal] = useState("");
  const [entries, setEntries] = useState<ThreeStepInspection[]>([]);
  const [dishes, setDishes] = useState<BiValue[]>([]);
  const [ingredients, setIngredients] = useState<BiValue[]>([]);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);

  const refresh = () => setEntries(getInspectionsForDate(date));

  useEffect(() => {
    setEntries(getInspectionsForDate(date));
  }, [date]);

  useEffect(() => {
    setDishes(dishNames());
    setIngredients(ingredientNames());
    setSupplierNames(getSuppliers().map((s) => s.name));
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "inspections");

  const entriesFor = (s: InspectionStage) =>
    entries.filter((e) => e.service === service && e.stage === s).sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));

  const stageIndex = STAGE_ORDER.indexOf(stage);
  const nextStage = STAGE_ORDER[stageIndex + 1];

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Three-Step Inspection · Kiểm Tra 3 Bước"
        subtitle="Every service, legally required · Mỗi ca phục vụ, bắt buộc theo quy định"
      />
      <div className="px-4 md:px-8">
        <LogDateBar date={date} onChange={setDate} />
        <datalist id={DISH_LIST_ID}>
          {dishes.map((d) => (
            <option key={d.en} value={d.en}>
              {d.vi}
            </option>
          ))}
        </datalist>
        <datalist id={INGREDIENT_LIST_ID}>
          {ingredients.map((i) => (
            <option key={i.en} value={i.en}>
              {i.vi}
            </option>
          ))}
        </datalist>
        <datalist id={SUPPLIER_LIST_ID}>
          {supplierNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="flex gap-2 mb-4">
          {(["lunch", "dinner"] as ServicePeriod[]).map((s) => (
            <button
              key={s}
              onClick={() => setService(s)}
              className={`flex-1 min-h-12 rounded-xl font-semibold text-sm border-2 ${
                service === s ? "bg-brand text-white border-brand" : "border-border text-foreground"
              }`}
            >
              {s === "lunch" ? "Lunch · Trưa" : "Dinner · Tối"}
            </button>
          ))}
        </div>
        {canEnter && (
          <div className="mb-4">
            <p className="text-xs text-muted mb-1">Meal · Bữa ăn</p>
            <input
              value={meal}
              onChange={(e) => setMeal(e.target.value)}
              placeholder="e.g. Jerk Chicken"
              className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
              list={DISH_LIST_ID}
            />
            <p className="text-xs text-muted mt-1">Entered once, used by all 3 steps · Nhập một lần, dùng cho cả 3 bước</p>
          </div>
        )}
        {/* One step at a time — the other two forms are a tap away, not a scroll past. */}
        <div className="mb-4">
          <p className="text-xs text-muted mb-1">
            Step {stageIndex + 1} of 3 · Bước {stageIndex + 1}/3
          </p>
          <div className="flex gap-2">
            {STAGE_ORDER.map((s, i) => {
              const active = s === stage;
              const logged = entriesFor(s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStage(s)}
                  aria-pressed={active}
                  className={`flex-1 min-h-16 rounded-xl border-2 px-1 py-2 flex flex-col items-center justify-center gap-0.5 ${
                    active ? "bg-brand text-white border-brand" : "border-border text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1 font-bold text-sm">
                    {i + 1}
                    {logged > 0 && <CheckCircle2 size={12} className={active ? "" : "text-success"} />}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-center">{STAGE_SHORT[s].en}</span>
                  <span className={`text-[11px] leading-tight text-center ${active ? "text-white/80" : "text-muted"}`}>
                    {STAGE_SHORT[s].vi}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <Card>
          <p className="font-semibold text-sm mb-3">
            {STAGE_LABEL[stage].en} · {STAGE_LABEL[stage].vi}
          </p>
          {canEnter && (
            <div className="mb-3">
              {stage === "before" && <BeforePrepForm date={date} service={service} meal={meal} staffName={session.name} onLogged={refresh} />}
              {stage === "during" && <DuringPrepForm date={date} service={service} meal={meal} staffName={session.name} onLogged={refresh} />}
              {stage === "before_serving" && <BeforeServingForm date={date} service={service} meal={meal} staffName={session.name} onLogged={refresh} />}
            </div>
          )}
          <EntryList entries={entriesFor(stage)} />
        </Card>
        {nextStage && (
          <button
            onClick={() => setStage(nextStage)}
            className="mt-3 w-full min-h-12 rounded-xl border-2 border-border font-semibold text-sm flex items-center justify-center gap-1"
          >
            Next: {STAGE_SHORT[nextStage].en} · Tiếp: {STAGE_SHORT[nextStage].vi}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function InspectionsPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="inspections">
        <InspectionsContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
