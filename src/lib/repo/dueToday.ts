import { todayIso } from "@/lib/storage";
import {
  getFridgeUnits,
  getTempReadingsForDate,
  getCleaningTasks,
  getSignoffsForDate,
  getInspectionsForDate,
} from "@/lib/repo/foodSafety";
import { computeDueTasks, type DueTaskId } from "./dueTodayRules";
import type { Bi, Role } from "@/lib/types";

/**
 * The recurring checks still outstanding today.
 *
 * The home screen used to answer "what is wrong?" — out-of-range readings,
 * overdue samples, open pest sightings. Useful, but the wrong question for
 * someone starting a shift, who needs "what do I still owe?" A fridge check
 * nobody has done is not a problem anywhere: it is a gap in a legally-required
 * record that surfaces weeks later, during an inspection.
 *
 * Only tasks on a known schedule appear. A delivery arriving, a batch being
 * cooked, a complaint — those happen on an event and can never be "due", so
 * listing them would create an item nobody can ever clear.
 *
 * This file reads the data; `dueTodayRules.ts` decides. The decision is where
 * the judgement is, so it lives somewhere it can be tested without a browser.
 */

export type DueTask = {
  id: DueTaskId;
  label: Bi;
  detail: Bi;
  href: string;
  urgency: number;
};

const PRESENTATION: Record<DueTaskId, { label: Bi; href: string; countsUnits: boolean }> = {
  "temp-morning": {
    label: { en: "Morning fridge & freezer check", vi: "Kiểm tra tủ lạnh buổi sáng" },
    href: "/food-safety/temperature",
    countsUnits: true,
  },
  "temp-evening": {
    label: { en: "Evening fridge & freezer check", vi: "Kiểm tra tủ lạnh buổi tối" },
    href: "/food-safety/temperature",
    countsUnits: true,
  },
  inspection: {
    label: { en: "Three-step food inspection", vi: "Kiểm tra thực phẩm 3 bước" },
    href: "/food-safety/inspections",
    countsUnits: false,
  },
  cleaning: {
    label: { en: "Cleaning schedule", vi: "Lịch vệ sinh" },
    href: "/food-safety/cleaning",
    countsUnits: true,
  },
};

function vietnamHour(now: Date): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        hour12: false,
      }).format(now)
    ) % 24
  );
}

/**
 * Everything outstanding, for the roles that actually do these checks.
 *
 * FOH is excluded: temperature, cleaning and inspections are kitchen work, and
 * a bartender shown four tasks they cannot action learns to skip the whole
 * list — including on the day it matters.
 */
export function getDueToday(role: Role, now: Date = new Date()): DueTask[] {
  if (role === "bartender") return [];

  const date = todayIso();
  const units = getFridgeUnits();
  const readings = getTempReadingsForDate(date);
  const cleaning = getCleaningTasks().filter((t) => t.active && t.frequency === "daily");
  const signedIds = new Set(
    getSignoffsForDate(date)
      .filter((s) => !s.revokedAt)
      .map((s) => s.taskId)
  );

  // The reading records which slot it belongs to, so a check written up late
  // still counts for the slot it was for.
  const readIn = (slot: "am" | "pm") =>
    new Set(readings.filter((r) => r.timeSlot === slot).map((r) => r.unitId)).size;

  const rules = computeDueTasks({
    hour: vietnamHour(now),
    unitCount: units.length,
    unitsReadAm: readIn("am"),
    unitsReadPm: readIn("pm"),
    inspectionsToday: getInspectionsForDate(date).length,
    dailyCleaningTotal: cleaning.length,
    dailyCleaningSigned: cleaning.filter((t) => signedIds.has(t.id)).length,
  });

  return rules.map((rule) => {
    const view = PRESENTATION[rule.id];
    return {
      id: rule.id,
      label: view.label,
      href: view.href,
      urgency: rule.urgency,
      detail: view.countsUnits
        ? {
            en: `${rule.outstanding} of ${rule.total} still to do`,
            vi: `Còn ${rule.outstanding}/${rule.total}`,
          }
        : {
            en: "Required every service — nothing logged today",
            vi: "Bắt buộc mỗi ca — hôm nay chưa ghi",
          },
    };
  });
}
