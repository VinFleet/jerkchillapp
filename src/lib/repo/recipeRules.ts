import type { Recipe } from "@/lib/types";

/**
 * Whether a recipe is complete enough to save.
 *
 * Kept import-free and pure so it is testable without a browser — the same
 * reasoning as lib/repo/orderRules.ts. A method is not required: a chef is
 * often still writing one up, or the dish is genuinely "in, taste, adjust,"
 * and the ingredient list already tells the next cook what to buy.
 */

export type RecipeDraftVerdict =
  | { ok: true }
  | { ok: false; reason: "name" | "portions" | "ingredients" | "ingredient_incomplete" };

export function validateRecipeDraft(
  draft: Pick<Recipe, "name" | "basePortions" | "ingredients">
): RecipeDraftVerdict {
  if (!draft.name.en.trim() && !draft.name.vi.trim()) return { ok: false, reason: "name" };
  if (!Number.isFinite(draft.basePortions) || draft.basePortions < 1) return { ok: false, reason: "portions" };
  if (draft.ingredients.length === 0) return { ok: false, reason: "ingredients" };
  const incomplete = draft.ingredients.some(
    (i) => (!i.name.en.trim() && !i.name.vi.trim()) || !Number.isFinite(i.qty) || i.qty <= 0
  );
  if (incomplete) return { ok: false, reason: "ingredient_incomplete" };
  return { ok: true };
}
