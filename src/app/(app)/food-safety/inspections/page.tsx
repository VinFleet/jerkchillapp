"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BigCheckbox } from "@/components/ui/BigCheckbox";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getInspectionsForDate, logBeforePrep, logDuringPrep, logBeforeServing, inspectionPassed } from "@/lib/repo/foodSafety";
import { todayIso } from "@/lib/storage";
import type { ThreeStepInspection, InspectionStage, ServicePeriod } from "@/lib/types";

const STAGE_LABEL: Record<InspectionStage, { en: string; vi: string }> = {
  before: { en: "Step 1 — Before preparation", vi: "Bước 1 — Trước khi chế biến" },
  during: { en: "Step 2 — During preparation", vi: "Bước 2 — Trong khi chế biến" },
  before_serving: { en: "Step 3 — Before serving", vi: "Bước 3 — Trước khi phục vụ" },
};

const STAGE_ORDER: InspectionStage[] = ["before", "during", "before_serving"];

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

function BeforePrepForm({ date, service, staffName, onLogged }: { date: string; service: ServicePeriod; staffName: string; onLogged: () => void }) {
  const [meal, setMeal] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [supplierSource, setSupplierSource] = useState("");
  const [qty, setQty] = useState("");
  const [sensoryOk, setSensoryOk] = useState(false);
  const [notes, setNotes] = useState("");

  const reset = () => {
    setMeal("");
    setIngredient("");
    setSupplierSource("");
    setQty("");
    setSensoryOk(false);
    setNotes("");
  };

  return (
    <div className="space-y-2">
      <input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Meal · Bữa ăn" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <input value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Ingredient · Nguyên liệu" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <input value={supplierSource} onChange={(e) => setSupplierSource(e.target.value)} placeholder="Supplier / source · Nhà cung cấp / nguồn gốc" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty · Số lượng" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <BigCheckbox label={{ en: "Sensory OK", vi: "Cảm quan đạt" }} checked={sensoryOk} onToggle={() => setSensoryOk((v) => !v)} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) · Ghi chú" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <Button
        className="w-full min-h-11 text-sm"
        disabled={!meal.trim() || !ingredient.trim() || !qty.trim()}
        onClick={() => {
          logBeforePrep({ date, service, meal: meal.trim(), ingredient: ingredient.trim(), supplierSource: supplierSource.trim(), qty: qty.trim(), sensoryOk, checkedBy: staffName, notes: notes.trim() || undefined });
          reset();
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
    </div>
  );
}

function DuringPrepForm({ date, service, staffName, onLogged }: { date: string; service: ServicePeriod; staffName: string; onLogged: () => void }) {
  const [meal, setMeal] = useState("");
  const [areaHygieneOk, setAreaHygieneOk] = useState(false);
  const [staffHygieneOk, setStaffHygieneOk] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setMeal("");
    setAreaHygieneOk(false);
    setStaffHygieneOk(false);
    setStartTime("");
    setEndTime("");
    setNotes("");
  };

  return (
    <div className="space-y-2">
      <input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Meal · Bữa ăn" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <div className="flex gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="flex-1 min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="flex-1 min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      </div>
      <BigCheckbox label={{ en: "Area / equipment hygiene OK", vi: "Vệ sinh khu vực / thiết bị đạt" }} checked={areaHygieneOk} onToggle={() => setAreaHygieneOk((v) => !v)} />
      <BigCheckbox label={{ en: "Staff hygiene OK", vi: "Vệ sinh nhân viên đạt" }} checked={staffHygieneOk} onToggle={() => setStaffHygieneOk((v) => !v)} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) · Ghi chú" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <Button
        className="w-full min-h-11 text-sm"
        disabled={!meal.trim() || !startTime || !endTime}
        onClick={() => {
          logDuringPrep({ date, service, meal: meal.trim(), areaHygieneOk, staffHygieneOk, startTime, endTime, checkedBy: staffName, notes: notes.trim() || undefined });
          reset();
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
    </div>
  );
}

function BeforeServingForm({ date, service, staffName, onLogged }: { date: string; service: ServicePeriod; staffName: string; onLogged: () => void }) {
  const [meal, setMeal] = useState("");
  const [dish, setDish] = useState("");
  const [sensoryOk, setSensoryOk] = useState(false);
  const [timeServed, setTimeServed] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setMeal("");
    setDish("");
    setSensoryOk(false);
    setTimeServed("");
    setNotes("");
  };

  return (
    <div className="space-y-2">
      <input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Meal · Bữa ăn" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <input value={dish} onChange={(e) => setDish(e.target.value)} placeholder="Dish · Món ăn" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <input type="time" value={timeServed} onChange={(e) => setTimeServed(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <BigCheckbox label={{ en: "Sensory OK", vi: "Cảm quan đạt" }} checked={sensoryOk} onToggle={() => setSensoryOk((v) => !v)} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) · Ghi chú" className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm" />
      <Button
        className="w-full min-h-11 text-sm"
        disabled={!meal.trim() || !dish.trim() || !timeServed}
        onClick={() => {
          logBeforeServing({ date, service, meal: meal.trim(), dish: dish.trim(), sensoryOk, timeServed, checkedBy: staffName, notes: notes.trim() || undefined });
          reset();
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
    </div>
  );
}

function InspectionsContent() {
  const { session } = useSession();
  const date = todayIso();
  const [service, setService] = useState<ServicePeriod>("lunch");
  const [entries, setEntries] = useState<ThreeStepInspection[]>([]);

  const refresh = () => setEntries(getInspectionsForDate(date));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "inspections");

  const entriesFor = (stage: InspectionStage) =>
    entries.filter((e) => e.service === service && e.stage === stage).sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Three-Step Inspection · Kiểm Tra 3 Bước"
        subtitle="Every service, legally required · Mỗi ca phục vụ, bắt buộc theo quy định"
      />
      <div className="px-4 md:px-8">
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
        <div className="space-y-4">
          {STAGE_ORDER.map((stage) => (
            <Card key={stage}>
              <p className="font-semibold text-sm mb-3">
                {STAGE_LABEL[stage].en} · {STAGE_LABEL[stage].vi}
              </p>
              {canEnter && (
                <div className="mb-3">
                  {stage === "before" && <BeforePrepForm date={date} service={service} staffName={session.name} onLogged={refresh} />}
                  {stage === "during" && <DuringPrepForm date={date} service={service} staffName={session.name} onLogged={refresh} />}
                  {stage === "before_serving" && <BeforeServingForm date={date} service={service} staffName={session.name} onLogged={refresh} />}
                </div>
              )}
              <EntryList entries={entriesFor(stage)} />
            </Card>
          ))}
        </div>
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
