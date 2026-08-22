/**
 * Which recurring checks are outstanding, as a pure decision.
 *
 * Separated from the repo so it can be proven without a browser or a seeded
 * database. This is the part with the judgement in it — when a check counts as
 * overdue rather than merely pending, and which role should see it — and that
 * is exactly the part worth testing.
 */

export type DueTaskId = "temp-morning" | "temp-evening" | "inspection" | "cleaning";

export type DueTaskRule = {
  id: DueTaskId;
  /** 0 = overdue, higher = still within its window. Sorts the list. */
  urgency: number;
  outstanding: number;
  total: number;
};

/** Morning readings are late after this hour. */
export const MORNING_DEADLINE_HOUR = 11;
/** The evening check isn't asked for before this. */
export const EVENING_FROM_HOUR = 16;
/** Service is plausibly under way after this, so the inspection can be asked for. */
export const INSPECTION_FROM_HOUR = 10;

export type DueInput = {
  hour: number;
  unitCount: number;
  unitsReadAm: number;
  unitsReadPm: number;
  inspectionsToday: number;
  dailyCleaningTotal: number;
  dailyCleaningSigned: number;
};

/**
 * Nagging about a task before its window opens is how a list gets ignored, so
 * each one only appears once it is genuinely askable — and turns urgent only
 * once its window has closed.
 */
export function computeDueTasks(input: DueInput): DueTaskRule[] {
  const tasks: DueTaskRule[] = [];

  if (input.unitCount > 0) {
    const morningOutstanding = input.unitCount - input.unitsReadAm;
    if (morningOutstanding > 0) {
      tasks.push({
        id: "temp-morning",
        urgency: input.hour >= MORNING_DEADLINE_HOUR ? 0 : 2,
        outstanding: morningOutstanding,
        total: input.unitCount,
      });
    }

    if (input.hour >= EVENING_FROM_HOUR) {
      const eveningOutstanding = input.unitCount - input.unitsReadPm;
      if (eveningOutstanding > 0) {
        tasks.push({
          id: "temp-evening",
          urgency: 1,
          outstanding: eveningOutstanding,
          total: input.unitCount,
        });
      }
    }
  }

  if (input.hour >= INSPECTION_FROM_HOUR && input.inspectionsToday === 0) {
    tasks.push({ id: "inspection", urgency: 1, outstanding: 1, total: 1 });
  }

  const cleaningOutstanding = input.dailyCleaningTotal - input.dailyCleaningSigned;
  if (input.dailyCleaningTotal > 0 && cleaningOutstanding > 0) {
    tasks.push({
      id: "cleaning",
      urgency: 3,
      outstanding: cleaningOutstanding,
      total: input.dailyCleaningTotal,
    });
  }

  return tasks.sort((a, b) => a.urgency - b.urgency);
}
