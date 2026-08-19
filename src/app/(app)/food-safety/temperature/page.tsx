"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getFridgeUnits, getTempReadingsForDate, logTempReading, correctTempReading } from "@/lib/repo/foodSafety";
import { todayIso } from "@/lib/storage";
import type { FridgeUnit, TempReading } from "@/lib/types";

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
          Cancel
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
  const date = todayIso();
  const [units, setUnits] = useState<FridgeUnit[]>([]);
  const [readings, setReadings] = useState<TempReading[]>([]);

  const refresh = () => setReadings(getTempReadingsForDate(date));

  useEffect(() => {
    setUnits(getFridgeUnits());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
