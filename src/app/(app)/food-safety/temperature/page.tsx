"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, ChevronLeft, ChevronRight, CalendarClock, Settings2 } from "lucide-react";
import Link from "next/link";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog, canEditSuppliers } from "@/lib/auth/permissions";
import { getFridgeUnits, getTempReadingsForDate, logTempReading, correctTempReading } from "@/lib/repo/foodSafety";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { FridgeUnit, TempReading } from "@/lib/types";

/**
 * Picks the day readings are viewed and logged against. Defaults to today; a
 * check that was missed and remembered the next morning can be put on the day
 * it actually happened, and the banner makes that impossible to do by accident.
 * Future dates are blocked.
 */
function LogDateBar({ date, onChange }: { date: string; onChange: (next: string) => void }) {
  const today = todayIso();
  const isToday = date === today;
  return (
    <div>
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

function ReadingForm({
  onSubmit,
  initial,
  onCancel,
}: {
  onSubmit: (tempC: number, note?: string) => void;
  initial?: number;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial !== undefined ? String(initial) : "");
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 p-3 rounded-xl bg-background">
      <div className="flex items-center gap-2 mb-2">
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="°C"
          className="w-24 min-h-12 rounded-xl border-2 border-border px-3 text-base font-bold focus:outline-none focus:border-brand"
        />
        <span className="text-muted text-sm">°C</span>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Corrective action (if out of range) · Hành động khắc phục"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm mb-2 focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-11" onClick={onCancel}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-11"
          disabled={value.trim() === ""}
          onClick={() => onSubmit(Number(value), note.trim() || undefined)}
        >
          Save · Lưu
        </Button>
      </div>
    </div>
  );
}

function UnitCard({ unit, date, readings, canEnter, staffName, onChanged }: {
  unit: FridgeUnit;
  date: string;
  readings: TempReading[];
  canEnter: boolean;
  staffName: string;
  onChanged: () => void;
}) {
  const [openSlot, setOpenSlot] = useState<"am" | "pm" | null>(null);
  const [correcting, setCorrecting] = useState<TempReading | null>(null);

  const forSlot = (slot: "am" | "pm") => readings.find((r) => r.unitId === unit.id && r.timeSlot === slot);

  const submit = (slot: "am" | "pm") => (tempC: number, note?: string) => {
    logTempReading(unit, date, slot, tempC, staffName, note);
    setOpenSlot(null);
    onChanged();
  };

  const submitCorrection = (tempC: number, note?: string) => {
    if (!correcting) return;
    correctTempReading(correcting.id, tempC, staffName, note);
    setCorrecting(null);
    onChanged();
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <Bi value={unit.name} className="font-semibold text-sm" />
        <span className="text-xs text-muted">
          {unit.targetMinC}° to {unit.targetMaxC}°C
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {(["am", "pm"] as const).map((slot) => {
          const reading = forSlot(slot);
          return (
            <div key={slot} className="rounded-xl bg-background p-3">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">{slot === "am" ? "AM" : "PM"}</p>
              {reading ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{reading.tempC}°C</span>
                    {reading.inRange ? (
                      <Badge tone="success">
                        <CheckCircle2 size={12} /> OK
                      </Badge>
                    ) : (
                      <Badge tone="danger">
                        <AlertTriangle size={12} /> Out of range
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-1">{reading.loggedBy}</p>
                  {canEnter && correcting?.id !== reading.id && (
                    <button
                      onClick={() => setCorrecting(reading)}
                      className="mt-1 flex items-center gap-1 text-[11px] text-brand font-semibold"
                    >
                      <Pencil size={11} /> Correct · Sửa
                    </button>
                  )}
                  {correcting?.id === reading.id && (
                    <ReadingForm initial={reading.tempC} onSubmit={submitCorrection} onCancel={() => setCorrecting(null)} />
                  )}
                </div>
              ) : canEnter ? (
                openSlot === slot ? (
                  <ReadingForm onSubmit={submit(slot)} onCancel={() => setOpenSlot(null)} />
                ) : (
                  <button
                    onClick={() => setOpenSlot(slot)}
                    className="min-h-11 w-full rounded-xl border-2 border-dashed border-brand-tint text-brand text-sm font-semibold"
                  >
                    Log · Ghi
                  </button>
                )
              ) : (
                <p className="text-sm text-muted">— Not logged —</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TemperatureContent() {
  const { session } = useSession();
  const [date, setDate] = useState(todayIso());
  const [units, setUnits] = useState<FridgeUnit[]>([]);
  const [readings, setReadings] = useState<TempReading[]>([]);

  const refresh = () => setReadings(getTempReadingsForDate(date));

  useEffect(() => {
    setUnits(getFridgeUnits());
    setReadings(getTempReadingsForDate(date));
  }, [date]);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "temperature");

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Fridge & Freezer Temp · Nhiệt Độ Tủ Lạnh & Tủ Đông"
        subtitle="Check twice daily · Kiểm tra hai lần mỗi ngày"
      />
      <div className="px-4 md:px-8 space-y-3">
        {canEditSuppliers(session.role) && (
          <Link
            href="/food-safety/equipment"
            className="flex items-center justify-between gap-2 min-h-[48px] px-4 rounded-xl border border-border text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <Settings2 size={16} className="text-muted" />
              Manage fridges & freezers · Quản lý tủ mát & tủ đông
            </span>
            <span className="text-muted">{units.length}</span>
          </Link>
        )}
        {units.length === 0 && (
          <p className="text-sm text-center text-muted py-6">
            No fridges or freezers added yet · Chưa thêm tủ mát hoặc tủ đông
          </p>
        )}
        <LogDateBar date={date} onChange={setDate} />
        {units.map((unit) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            date={date}
            readings={readings}
            canEnter={canEnter}
            staffName={session.name}
            onChanged={refresh}
          />
        ))}
      </div>
    </div>
  );
}

export default function TemperaturePage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="temperature">
        <TemperatureContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
