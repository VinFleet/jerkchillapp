/**
 * Tests for which recurring checks show as due.
 *
 * Run: npm run test:due
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeDueTasks, type DueInput } from "./dueTodayRules.ts";

const base: DueInput = {
  hour: 9,
  unitCount: 5,
  unitsReadAm: 5,
  unitsReadPm: 5,
  inspectionsToday: 1,
  dailyCleaningTotal: 6,
  dailyCleaningSigned: 6,
};

const ids = (input: Partial<DueInput>) =>
  computeDueTasks({ ...base, ...input }).map((t) => t.id);

test("a day where everything is done shows nothing", () => {
  // An empty list is the point: a to-do that always has something in it stops
  // being read.
  assert.deepEqual(computeDueTasks(base), []);
});

test("the morning check is pending early, overdue after 11:00", () => {
  const early = computeDueTasks({ ...base, hour: 9, unitsReadAm: 0 });
  assert.equal(early[0].id, "temp-morning");
  assert.equal(early[0].urgency, 2, "still within its window");

  const late = computeDueTasks({ ...base, hour: 11, unitsReadAm: 0 });
  assert.equal(late[0].urgency, 0, "overdue once the morning has gone");
});

test("the evening check isn't asked for during the morning", () => {
  // Nagging before a task's window opens teaches people to ignore the list.
  assert.ok(!ids({ hour: 9, unitsReadPm: 0 }).includes("temp-evening"));
  assert.ok(!ids({ hour: 15, unitsReadPm: 0 }).includes("temp-evening"));
  assert.ok(ids({ hour: 16, unitsReadPm: 0 }).includes("temp-evening"));
});

test("a partly-done check still counts as outstanding", () => {
  // Three of five fridges read is not "done" — the record has two gaps in it.
  const [task] = computeDueTasks({ ...base, hour: 9, unitsReadAm: 3 });
  assert.equal(task.id, "temp-morning");
  assert.equal(task.outstanding, 2);
  assert.equal(task.total, 5);
});

test("the inspection is asked for once service is under way", () => {
  assert.ok(!ids({ hour: 8, inspectionsToday: 0 }).includes("inspection"));
  assert.ok(ids({ hour: 10, inspectionsToday: 0 }).includes("inspection"));
  assert.ok(!ids({ hour: 14, inspectionsToday: 1 }).includes("inspection"));
});

test("cleaning appears only while something is unsigned", () => {
  assert.ok(ids({ dailyCleaningSigned: 5 }).includes("cleaning"));
  assert.ok(!ids({ dailyCleaningSigned: 6 }).includes("cleaning"));
  // A restaurant with no daily cleaning tasks configured shouldn't get a
  // permanent "0 of 0 outstanding" item.
  assert.ok(!ids({ dailyCleaningTotal: 0, dailyCleaningSigned: 0 }).includes("cleaning"));
});

test("no fridge units means no temperature tasks, not a divide-by-zero", () => {
  const tasks = computeDueTasks({ ...base, unitCount: 0, unitsReadAm: 0, unitsReadPm: 0, hour: 20 });
  assert.ok(!tasks.some((t) => t.id.startsWith("temp")));
});

test("the most urgent thing is first", () => {
  const tasks = computeDueTasks({
    ...base,
    hour: 17,
    unitsReadAm: 0,
    unitsReadPm: 0,
    inspectionsToday: 0,
    dailyCleaningSigned: 0,
  });
  assert.deepEqual(
    tasks.map((t) => t.id),
    ["temp-morning", "temp-evening", "inspection", "cleaning"],
    "overdue morning check outranks everything else"
  );
  assert.equal(tasks[0].urgency, 0);
});
