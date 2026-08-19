import type { Recipe, RecipeFlag, Role } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_RECIPES } from "@/lib/seed/recipes";

const KEY = "recipes_v2";
const FLAGS_KEY = "recipe_flags";

export function ensureRecipesSeeded() {
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
