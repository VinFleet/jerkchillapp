import type { DishSalesCount } from "@/lib/types";
import { readList, writeList, newId } from "@/lib/storage";
import { getStockItems, getEntry } from "@/lib/repo/stock";

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
      return {
        stockItemId: item.id,
        name: item.name,
        unit: item.unit,
        theoretical,
        actual,
        variance: actual - theoretical,
      };
    })
    .filter((row) => row.theoretical > 0 || row.actual > 0);
}
