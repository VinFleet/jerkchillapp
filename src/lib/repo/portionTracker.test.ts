/**
 * Tests for the portion tracker arithmetic.
 *
 * Run: npm run test:portions
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  analysePortions,
  currentPhase,
  countOutstanding,
  type PortionRow,
} from "./portionTrackerRules.ts";

const row = (over: Partial<PortionRow> = {}): PortionRow => ({
  itemId: "jerk-chicken",
  opening: 0,
  produced: 0,
  closing: null,
  suggested: null,
  ...over,
});

test("asks for the right count at the right time of day", () => {
  // Asking for both all day is how a closing figure ends up in the opening box.
  assert.equal(currentPhase(7), "opening");
  assert.equal(currentPhase(10), "opening");
  assert.equal(currentPhase(11), "idle", "mid-service asks for nothing");
  assert.equal(currentPhase(19), "idle");
  assert.equal(currentPhase(20), "closing");
  assert.equal(currentPhase(23), "closing");
});

test("works out what went out today", () => {
  // Started with 4, made 20, closed with 6 -> 18 went out.
  const insight = analysePortions(row({ opening: 4, produced: 20, closing: 6 }));
  assert.equal(insight.usedToday, 18);
  assert.equal(insight.leftOver, 6);
});

test("tells the chef how many to make, net of what's left", () => {
  // 18 went out and 6 are still in the fridge, so make 12 — not 18.
  const insight = analysePortions(row({ opening: 4, produced: 20, closing: 6 }));
  assert.equal(insight.toPrep, 12);
});

test("never asks for a negative batch", () => {
  // Sold 2, still holding 15. "Make -13" is not an instruction.
  const insight = analysePortions(row({ opening: 15, produced: 2, closing: 15 }));
  assert.equal(insight.usedToday, 2);
  assert.equal(insight.toPrep, 0);
});

test("a sell-out asks for at least what went out", () => {
  const insight = analysePortions(row({ opening: 0, produced: 20, closing: 0 }));
  assert.equal(insight.usedToday, 20);
  assert.equal(insight.toPrep, 20, "nothing left over, so make the full amount");
});

test("flags a closing count that cannot be true", () => {
  // 12 were ever available; a closing count of 15 is a mistype, and reporting
  // "used -3" as though it were real is worse than saying so.
  const insight = analysePortions(row({ opening: 2, produced: 10, closing: 15 }));
  assert.equal(insight.impossible, true);
  assert.equal(insight.usedToday, null);
  assert.equal(insight.toPrep, null, "no suggestion to fall back on here");
});

test("before a closing count, falls back to the planner rather than guessing", () => {
  const withHistory = analysePortions(row({ opening: 4, produced: 20, suggested: 18 }));
  assert.equal(withHistory.usedToday, null);
  assert.equal(withHistory.toPrep, 18);

  const noHistory = analysePortions(row({ opening: 4, produced: 20 }));
  assert.equal(noHistory.toPrep, null, "a new item invents nothing");
});

test("zero closing is a real answer, not a missing one", () => {
  const insight = analysePortions(row({ opening: 0, produced: 12, closing: 0 }));
  assert.equal(insight.impossible, false);
  assert.equal(insight.usedToday, 12);
  assert.equal(insight.leftOver, 0);
});

test("counts what still needs entering", () => {
  const rows = [
    row({ itemId: "a", opening: 4, produced: 10, closing: 2 }),
    row({ itemId: "b", opening: 4, produced: 10, closing: null }),
    row({ itemId: "c", opening: 0, produced: 0, closing: null }),
  ];
  assert.equal(countOutstanding(rows, "closing"), 2);
  assert.equal(countOutstanding(rows, "opening"), 1, "only the untouched one");
  assert.equal(countOutstanding(rows, "idle"), 0);
});
