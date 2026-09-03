import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRecipeDraft } from "./recipeRules.ts";

const ok = {
  name: { en: "Jerk Chicken", vi: "Gà Jerk" },
  basePortions: 4,
  ingredients: [{ id: "i1", name: { en: "Chicken thigh", vi: "Đùi gà" }, qty: 2, unit: "kg" }],
};

test("a complete draft passes", () => {
  assert.deepEqual(validateRecipeDraft(ok), { ok: true });
});

test("a Vietnamese-only name is enough — neither language is forced", () => {
  assert.deepEqual(
    validateRecipeDraft({ ...ok, name: { en: "", vi: "Gà Jerk" } }),
    { ok: true }
  );
});

test("no name in either language fails", () => {
  assert.deepEqual(validateRecipeDraft({ ...ok, name: { en: "  ", vi: "" } }), { ok: false, reason: "name" });
});

test("base portions must be a real, positive count", () => {
  assert.deepEqual(validateRecipeDraft({ ...ok, basePortions: 0 }), { ok: false, reason: "portions" });
  assert.deepEqual(validateRecipeDraft({ ...ok, basePortions: NaN }), { ok: false, reason: "portions" });
});

test("at least one ingredient is required — a recipe with none tells nobody what to buy", () => {
  assert.deepEqual(validateRecipeDraft({ ...ok, ingredients: [] }), { ok: false, reason: "ingredients" });
});

test("every ingredient needs a name and a positive quantity", () => {
  assert.deepEqual(
    validateRecipeDraft({ ...ok, ingredients: [{ id: "i1", name: { en: "", vi: "" }, qty: 2, unit: "kg" }] }),
    { ok: false, reason: "ingredient_incomplete" }
  );
  assert.deepEqual(
    validateRecipeDraft({ ...ok, ingredients: [{ id: "i1", name: { en: "Salt", vi: "Muối" }, qty: 0, unit: "g" }] }),
    { ok: false, reason: "ingredient_incomplete" }
  );
});

test("a method is not required — some recipes are still being written up", () => {
  // validateRecipeDraft takes no `steps` field at all; an empty method
  // array elsewhere in the app must not block saving.
  assert.deepEqual(validateRecipeDraft(ok), { ok: true });
});
