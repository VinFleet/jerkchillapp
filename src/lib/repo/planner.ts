import type { PlannerDecision, Bi } from "@/lib/types";
import { readList, writeList, newId } from "@/lib/storage";
import { getStockItems, getRecentEntries, getBarOnHand } from "@/lib/repo/stock";
import { getRecipe } from "@/lib/repo/recipes";
import { scaleQty } from "@/lib/scale";

const DECISIONS_KEY = "planner_decisions";

function getAllDecisions(): PlannerDecision[] {
  return readList<PlannerDecision>(DECISIONS_KEY);
}

/**
 * Suggest tomorrow's production quantity for a kitchen item from recent
 * Produced figures, pulled down slightly for every recent night the item
 * closed with leftovers (a simple stand-in for a real waste-aware model).
 */
export function suggestQuantity(itemId: string, date: string): number {
  const recent = getRecentEntries(itemId, date, 5);
  if (recent.length === 0) return 0;

  const avgProduced = recent.reduce((sum, e) => sum + e.produced, 0) / recent.length;
  const leftoverNights = recent.filter((e) => (e.closing ?? 0) > 0).length;
  const adjustment = 1 - Math.min(leftoverNights, 3) * 0.08;

  return Math.max(0, Math.round(avgProduced * adjustment));
}

export function getDecision(itemId: string, date: string): PlannerDecision | undefined {
  return getAllDecisions().find((d) => d.itemId === itemId && d.date === date);
}

export function getOrSuggestDecision(itemId: string, date: string): PlannerDecision {
  const existing = getDecision(itemId, date);
  if (existing) return existing;
  return {
    id: newId("plan"),
    itemId,
    date,
    suggestedQty: suggestQuantity(itemId, date),
    confirmedQty: null,
    confirmedBy: null,
    confirmedAt: null,
  };
}

export function confirmDecision(itemId: string, date: string, qty: number, confirmedBy: string) {
  const all = getAllDecisions();
  const idx = all.findIndex((d) => d.itemId === itemId && d.date === date);
  const base = idx >= 0 ? all[idx] : getOrSuggestDecision(itemId, date);
  const updated: PlannerDecision = {
    ...base,
    confirmedQty: qty,
    confirmedBy,
    confirmedAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  writeList(DECISIONS_KEY, all);
  return updated;
}

export type ReorderFlag = {
  itemId: string;
  name: { en: string; vi: string };
  onHand: number;
  par: number;
  unit: string;
};

/** Bar items currently below par — due for reorder. */
export function getReorderFlags(date: string): ReorderFlag[] {
  return getStockItems("bar")
    .filter((item) => typeof item.par === "number")
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      onHand: getBarOnHand(item.id, date),
      par: item.par as number,
      unit: item.unit,
    }))
    .filter((f) => f.onHand < f.par);
}

export type IngredientForecastRow = {
  name: Bi;
  unit: string;
  qty: number;
};

/**
 * Rolls the day's planner quantities (whatever the chef confirmed, or the
 * historical suggestion if not yet confirmed) up through each dish's Recipe
 * Book ingredients — e.g. how many chicken leg quarters today's planned
 * Jerk Chicken portions imply. Follows the chef's actual decision rather
 * than a separate parallel guess, so it stays honest as they adjust.
 *
 * Deliberately excludes any ingredient that is itself a kitchen StockItem
 * (e.g. Jerk Chicken Meal lists "Rice and Peas" as a plate component, but
 * Rice and Peas is also its own independently-planned prep item) — those
 * are already covered by that item's own row in the planner, and rolling
 * them up here too would double-count the same batch.
 */
export function getIngredientForecast(date: string): IngredientForecastRow[] {
  const kitchenItems = getStockItems("kitchen");
  const trackedNames = new Set(kitchenItems.map((i) => i.name.en));
  const totals = new Map<string, IngredientForecastRow>();

  for (const item of kitchenItems) {
    if (!item.recipeId) continue;
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;

    const decision = getDecision(item.id, date);
    const portions = decision?.confirmedQty ?? decision?.suggestedQty ?? suggestQuantity(item.id, date);
    if (portions <= 0) continue;

    for (const ing of recipe.ingredients) {
      if (trackedNames.has(ing.name.en)) continue;
      const scaled = scaleQty(ing.qty, recipe.basePortions, portions);
      const key = `${ing.name.en}__${ing.unit}`;
      const existing = totals.get(key);
      if (existing) existing.qty += scaled;
      else totals.set(key, { name: ing.name, unit: ing.unit, qty: scaled });
    }
  }

  return Array.from(totals.values()).sort((a, b) => b.qty - a.qty);
}
