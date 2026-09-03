import type { Recipe, RecipeFlag, Role } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, isLegacyTenant } from "@/lib/storage";
import { SEED_RECIPES } from "@/lib/seed/recipes";

// v3: pack sizes rewritten per-can so they stay correct when a recipe is
// scaled (a total can count silently went stale at any non-base portion
// count). Bumping this key again would now blow away real, user-written
// recipes — safe only while every existing record is still J&C's seed.
const KEY = "recipes_v3";
const FLAGS_KEY = "recipe_flags";

export function ensureRecipesSeeded() {
  // Jerk & Chill's data belongs to Jerk & Chill. A neutral branch starts
  // empty here and its owner builds their own — the seed below is customer
  // number one's restaurant, not a template.
  if (!isLegacyTenant()) {
    markSeeded(KEY);
    return;
  }

  if (isSeeded(KEY)) return;
  writeList(KEY, SEED_RECIPES);
  markSeeded(KEY);
}

export function getRecipes(): Recipe[] {
  return readList<Recipe>(KEY);
}

export function getRecipe(id: string): Recipe | undefined {
  return getRecipes().find((r) => r.id === id);
}

export function saveRecipe(recipe: Recipe) {
  const all = getRecipes();
  const idx = all.findIndex((r) => r.id === recipe.id);
  if (idx >= 0) all[idx] = recipe;
  else all.push(recipe);
  writeList(KEY, all);
}

/**
 * Recipes carry no legal weight the way a food-safety log does, so a
 * mistaken addition can just be removed — no tamper-evident trail required.
 */
export function deleteRecipe(id: string) {
  writeList(
    KEY,
    getRecipes().filter((r) => r.id !== id)
  );
}

/** A fresh recipe to start writing up, before anyone has typed anything into it. */
export function blankRecipe(category: Recipe["category"] = "main"): Recipe {
  return {
    id: newId("recipe"),
    name: { en: "", vi: "" },
    category,
    basePortions: 4,
    ingredients: [],
    steps: [],
    updatedAt: new Date().toISOString(),
  };
}

export { validateRecipeDraft, type RecipeDraftVerdict } from "./recipeRules";

export function getFlags(): RecipeFlag[] {
  return readList<RecipeFlag>(FLAGS_KEY);
}

export function getOpenFlagsForRecipe(recipeId: string): RecipeFlag[] {
  return getFlags().filter((f) => f.recipeId === recipeId && !f.resolved);
}

export function raiseFlag(recipeId: string, raisedBy: string, role: Role, note: string) {
  const flags = getFlags();
  flags.push({
    id: newId("flag"),
    recipeId,
    raisedBy,
    role,
    note,
    createdAt: new Date().toISOString(),
    resolved: false,
  });
  writeList(FLAGS_KEY, flags);
}

export function resolveFlag(flagId: string) {
  const flags = getFlags();
  const idx = flags.findIndex((f) => f.id === flagId);
  if (idx >= 0) {
    flags[idx] = { ...flags[idx], resolved: true };
    writeList(FLAGS_KEY, flags);
  }
}
