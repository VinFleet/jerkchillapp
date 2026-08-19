"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getCleaningTasks, isCleaningSignedOff, signOffCleaning, revokeCleaningSignoff } from "@/lib/repo/foodSafety";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { CleaningTask, CleaningFrequency } from "@/lib/types";

const FREQ_LABEL: Record<CleaningFrequency, { en: string; vi: string }> = {
  after_use: { en: "After every use", vi: "Sau mỗi lần dùng" },
  daily: { en: "Daily", vi: "Hằng ngày" },
  weekly: { en: "Weekly", vi: "Hằng tuần" },
  monthly: { en: "Monthly", vi: "Hằng tháng" },
};

const FREQ_ORDER: CleaningFrequency[] = ["after_use", "daily", "weekly", "monthly"];
const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(dateIso, diff);
}

function weekDatesFrom(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
}

function WeekNav({ monday, onChange }: { monday: string; onChange: (m: string) => void }) {
  const shift = (days: number) => onChange(addDaysIso(monday, days));
  const dates = weekDatesFrom(monday);
  return (
    <div className="flex items-center gap-2 mb-4">
      <button onClick={() => shift(-7)} className="p-2 text-brand" aria-label="Previous week">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {dates[0]} – {dates[6]}
      </span>
      <button onClick={() => shift(7)} className="p-2 text-brand" aria-label="Next week">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function CleaningContent() {
  const { session } = useSession();
  const [monday, setMonday] = useState(mondayOf(todayIso()));
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [, setRefreshKey] = useState(0);

  useEffect(() => {
    setTasks(getCleaningTasks());
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "cleaning");
  const dates = weekDatesFrom(monday);
  const today = todayIso();

  const grouped = FREQ_ORDER.map((freq) => ({ freq, tasks: tasks.filter((t) => t.frequency === freq) })).filter(
    ({ tasks: t }) => t.length > 0
  );

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader title="Cleaning Schedule · Lịch Vệ Sinh" subtitle="Weekly sign-off grid · Bảng xác nhận theo tuần" />
      <div className="px-4 md:px-8">
        <WeekNav monday={monday} onChange={setMonday} />
        <div className="space-y-6">
          {grouped.map(({ freq, tasks: freqTasks }) => (
            <div key={freq}>
              <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
                {FREQ_LABEL[freq].en} · {FREQ_LABEL[freq].vi}
              </h2>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="border-collapse w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-muted font-semibold pb-2 pr-2 sticky left-0 bg-background">Area</th>
                      {dates.map((d, i) => (
                        <th key={d} className={`text-xs font-semibold pb-2 px-1 text-center ${d === today ? "text-brand" : "text-muted"}`}>
                          {DAY_LABEL[i]}
                          <br />
                          {d.slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {freqTasks.map((task) => (
                      <tr key={task.id}>
                        <td className="text-sm font-semibold py-1 pr-2 sticky left-0 bg-background whitespace-nowrap">
                          <Bi value={task.area} mode="inline" />
                        </td>
                        {dates.map((d) => {
                          const signed = isCleaningSignedOff(task.id, d);
                          return (
                            <td key={d} className="p-1 text-center">
                              <button
                                disabled={!canEnter}
                                aria-label={`${task.area.en} — ${d}`}
                                onClick={() => {
                                  if (signed) {
                                    // Withdrawing a sign-off is a change to a legal
                                    // record, so it needs a reason on file — never a
                                    // silent one-tap reversal.
                                    const reason = window.prompt(
                                      `Withdraw the sign-off for ${task.area.en} on ${d}?\nRút lại xác nhận cho ${task.area.vi} ngày ${d}?\n\nReason · Lý do:`
                                    );
                                    if (!reason || !reason.trim()) return;
                                    revokeCleaningSignoff(task.id, d, session.name, reason.trim());
                                  } else {
                                    signOffCleaning(task.id, d, session.name);
                                  }
                                  setRefreshKey((k) => k + 1);
                                }}
                                className={`w-11 h-11 rounded-lg flex items-center justify-center mx-auto border-2 ${
                                  signed ? "bg-success text-white border-success" : "border-border text-transparent"
                                } disabled:opacity-50`}
                              >
                                <Check size={18} strokeWidth={3} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        {tasks.length === 0 && <p className="text-muted text-center py-10 text-sm">No tasks yet · Chưa có mục nào</p>}
      </div>
    </div>
  );
}

export default function CleaningPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="cleaning">
        <CleaningContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
