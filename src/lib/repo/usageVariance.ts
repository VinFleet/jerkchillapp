import type { DishSalesCount, Bi } from "@/lib/types";
import { readList, writeList, newId } from "@/lib/storage";
import { getStockItems, getEntry, costPerUnitFor } from "@/lib/repo/stock";
import { getRecipe } from "@/lib/repo/recipes";
import { scaleQty } from "@/lib/scale";

const SALES_COUNT_KEY = "dish_sales_counts";

function getAll(): DishSalesCount[] {
  return readList<DishSalesCount>(SALES_COUNT_KEY);
}

export function getSalesCount(stockItemId: string, date: string): DishSalesCount | undefined {
  return getAll().find((c) => c.stockItemId === stockItemId && c.date === date);
}

export function setSalesCount(stockItemId: string, date: string, qtySold: number, enteredBy: string): DishSalesCount {
  const all = getAll();
  const idx = all.findIndex((c) => c.stockItemId === stockItemId && c.date === date);
  if (idx >= 0) {
    all[idx] = { ...all[idx], qtySold, enteredBy, updatedAt: new Date().toISOString() };
    writeList(SALES_COUNT_KEY, all);
    return all[idx];
  }
  const entry: DishSalesCount = { id: newId("dsc"), stockItemId, date, qtySold, enteredBy, updatedAt: new Date().toISOString() };
  all.push(entry);
  writeList(SALES_COUNT_KEY, all);
  return entry;
}

export type VarianceRow = {
  stockItemId: string;
  name: { en: string; vi: string };
  unit: string;
  theoretical: number;
  actual: number;
  variance: number;
  /** What the unexplained gap cost, where the dish has a known cost per portion. */
  varianceCostVnd: number | null;
};

/** Ingredient-level variance — the spec's actual ask: recipe quantity × units sold vs. what stock movement says was really used. */
export type IngredientVarianceRow = {
  name: Bi;
  unit: string;
  /** What the recipes say should have been used for the dishes sold. */
  theoretical: number;
  /** What the recipes say was used for the dishes actually consumed out of stock. */
  actual: number;
  variance: number;
};

/**
 * theoretical = units sold (POS-style count entered for the day)
 * actual = opening + produced - closing, i.e. what the stock log shows was
 * actually consumed — the gap between the two is real, unexplained
 * shrinkage or waste, not an estimate.
 */
export function getVarianceForDate(date: string): VarianceRow[] {
  return getStockItems("kitchen")
    .filter((item) => item.prepCategory)
    .map((item) => {
      const entry = getEntry(item.id, date);
      const actual = entry ? entry.opening + entry.produced - (entry.closing ?? entry.opening + entry.produced) : 0;
      const theoretical = getSalesCount(item.id, date)?.qtySold ?? 0;
      const variance = actual - theoretical;
      const unitCost = costPerUnitFor(item);
      return {
        stockItemId: item.id,
        name: item.name,
        unit: item.unit,
        theoretical,
        actual,
        variance,
        varianceCostVnd: unitCost === null ? null : Math.round(variance * unitCost),
      };
    })
    .filter((row) => row.theoretical > 0 || row.actual > 0);
}

/** Total VND value of the day's unexplained gap, across dishes with a known cost. */
export function getVarianceCostForDate(date: string): number {
  return getVarianceForDate(date).reduce((sum, r) => sum + (r.varianceCostVnd ?? 0), 0);
}

/**
 * Rolls each dish's variance up through its recipe to ingredient level — this
 * is what the spec actually asks for ("Recipe Book cost/qty × units sold ...
 * compared against actual usage"), and it's where real shrinkage shows up:
 * a dish count can look fine while an ingredient quietly runs over.
 *
 * Ingredients that are themselves tracked kitchen items (Rice and Peas is a
 * component of the Jerk Chicken Meal but also its own prep item) are skipped,
 * since they already have their own row — same rule as the planner's forecast.
 */
export function getIngredientVarianceForDate(date: string): IngredientVarianceRow[] {
  const kitchenItems = getStockItems("kitchen");
  const trackedNames = new Set(kitchenItems.map((i) => i.name.en));
  const totals = new Map<string, IngredientVarianceRow>();

  for (const row of getVarianceForDate(date)) {
    const item = kitchenItems.find((i) => i.id === row.stockItemId);
    if (!item?.recipeId) continue;
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      if (trackedNames.has(ing.name.en)) continue;
      const key = `${ing.name.en}__${ing.unit}`;
      const existing = totals.get(key) ?? { name: ing.name, unit: ing.unit, theoretical: 0, actual: 0, variance: 0 };
      existing.theoretical += scaleQty(ing.qty, recipe.basePortions, row.theoretical);
      existing.actual += scaleQty(ing.qty, recipe.basePortions, row.actual);
      existing.variance = existing.actual - existing.theoretical;
      totals.set(key, existing);
    }
  }

  return Array.from(totals.values())
    .filter((r) => Math.abs(r.variance) > 0.001)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}
