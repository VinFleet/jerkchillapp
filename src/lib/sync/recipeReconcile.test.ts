import { test } from "node:test";
import assert from "node:assert/strict";
import { SYNCED_COLLECTIONS } from "./collections.ts";
import type { Recipe } from "@/lib/types";

/**
 * The recipe reconciler, exercised on its own — kept apart from
 * collections.test.ts so this file never collides with edits landing there
 * in parallel. Convergence and idempotency are the two properties every
 * reconciler in this codebase is required to hold (CLAUDE.md rule 4).
 */

const reconcile = SYNCED_COLLECTIONS.recipes_v3.reconcile!;

const base: Recipe = {
  id: "r1",
  name: { en: "Jerk Chicken", vi: "Gà Jerk" },
  category: "main",
  basePortions: 4,
  ingredients: [{ id: "i1", name: { en: "Chicken thigh", vi: "Đùi gà" }, qty: 2, unit: "kg" }],
  steps: [{ id: "s1", text: { en: "Marinate overnight", vi: "Ướp qua đêm" } }],
  updatedAt: "2026-09-01T10:00:00.000Z",
};

test("an ingredient added on one device and a step added on the other both survive", () => {
  const withNewIngredient: Recipe = {
    ...base,
    ingredients: [...base.ingredients, { id: "i2", name: { en: "Scotch bonnet", vi: "Ớt Scotch bonnet" }, qty: 3, unit: "quả" }],
    updatedAt: "2026-09-01T10:05:00.000Z",
  };
  const withNewStep: Recipe = {
    ...base,
    steps: [...base.steps, { id: "s2", text: { en: "Grill over pimento wood", vi: "Nướng trên gỗ pimento" } }],
    updatedAt: "2026-09-01T10:03:00.000Z",
  };

  const merged = reconcile(withNewStep, withNewIngredient) as Recipe;
  assert.equal(merged.ingredients.length, 2, "the ingredient added on the other device must not vanish");
  assert.equal(merged.steps.length, 2, "the step added on this device must not vanish");
  assert.ok(merged.ingredients.some((i) => i.id === "i2"));
  assert.ok(merged.steps.some((s) => s.id === "s2"));
});

test("editing the SAME item on both sides picks the later record's version, not both", () => {
  const localEdit: Recipe = {
    ...base,
    ingredients: [{ ...base.ingredients[0], qty: 3 }],
    updatedAt: "2026-09-01T10:10:00.000Z",
  };
  const remoteEdit: Recipe = {
    ...base,
    ingredients: [{ ...base.ingredients[0], qty: 5 }],
    updatedAt: "2026-09-01T10:20:00.000Z", // later
  };
  const merged = reconcile(localEdit, remoteEdit) as Recipe;
  assert.equal(merged.ingredients.length, 1);
  assert.equal(merged.ingredients[0].qty, 5, "the later-updated record's edit to the same ingredient wins");
});

test("scalar fields (notes, name) follow the later record, same as plain LWW", () => {
  const older: Recipe = { ...base, notes: { en: "old note", vi: "" }, updatedAt: "2026-09-01T10:00:00.000Z" };
  const newer: Recipe = { ...base, notes: { en: "new note", vi: "" }, updatedAt: "2026-09-01T11:00:00.000Z" };
  const merged = reconcile(older, newer) as Recipe;
  assert.equal(merged.notes?.en, "new note");
});

test("convergence: merging in either order produces the same result", () => {
  const a: Recipe = { ...base, ingredients: [...base.ingredients, { id: "i2", name: { en: "A", vi: "" }, qty: 1, unit: "g" }], updatedAt: "2026-09-01T10:05:00.000Z" };
  const b: Recipe = { ...base, steps: [...base.steps, { id: "s2", text: { en: "B", vi: "" } }], updatedAt: "2026-09-01T10:03:00.000Z" };
  const ab = reconcile(a, b) as Recipe;
  const ba = reconcile(b, a) as Recipe;
  assert.deepEqual(ab, ba);
});

test("idempotent: merging a record with itself changes nothing", () => {
  const merged = reconcile(base, base) as Recipe;
  assert.deepEqual(merged, base);
});

test("merging twice in a row is stable", () => {
  const a: Recipe = { ...base, ingredients: [...base.ingredients, { id: "i2", name: { en: "A", vi: "" }, qty: 1, unit: "g" }], updatedAt: "2026-09-01T10:05:00.000Z" };
  const once = reconcile(base, a) as Recipe;
  const twice = reconcile(once, a) as Recipe;
  assert.deepEqual(once, twice);
});
