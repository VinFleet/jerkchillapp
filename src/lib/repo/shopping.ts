import type { OrderingMeta, SupplyItem } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso } from "@/lib/storage";
import { SEED_SUPPLY_ITEMS } from "@/lib/seed/shopping";
import { getStockItems, getBarOnHand } from "@/lib/repo/stock";
import { getSuppliers } from "@/lib/repo/suppliers";

const META_KEY = "ordering_meta";
const SUPPLY_KEY = "supply_items";

export function ensureShoppingSeeded() {
  if (isSeeded(SUPPLY_KEY)) return;
  writeList(SUPPLY_KEY, SEED_SUPPLY_ITEMS);
  markSeeded(SUPPLY_KEY);
}

// ---------- Ordering metadata overlay for bar StockItems ----------

export function getOrderingMeta(stockItemId: string): OrderingMeta {
  return (
    readList<OrderingMeta>(META_KEY).find((m) => m.stockItemId === stockItemId) ?? {
      stockItemId,
      packCostVnd: null,
      lastOrderedAt: null,
    }
  );
}

export function updateOrderingMeta(stockItemId: string, patch: Partial<Omit<OrderingMeta, "stockItemId">>) {
  const all = readList<OrderingMeta>(META_KEY);
  const idx = all.findIndex((m) => m.stockItemId === stockItemId);
  if (idx >= 0) all[idx] = { ...all[idx], ...patch };
  else all.push({ stockItemId, packCostVnd: null, lastOrderedAt: null, ...patch });
  writeList(META_KEY, all);
}

export function markBarItemOrdered(stockItemId: string) {
  updateOrderingMeta(stockItemId, { lastOrderedAt: todayIso() });
}

// ---------- Kitchen supplies ----------

export function getSupplyItems(): SupplyItem[] {
  return readList<SupplyItem>(SUPPLY_KEY);
}

export function addSupplyItem(name: string, unit: string, par: number): SupplyItem {
  const entry: SupplyItem = {
    id: newId("supply"),
    name: { en: name, vi: name },
    packSize: "",
    packCostVnd: null,
    unit,
    par,
    onHand: 0,
    lastOrderedAt: null,
  };
  const all = getSupplyItems();
  all.push(entry);
  writeList(SUPPLY_KEY, all);
  return entry;
}

export function updateSupplyItem(id: string, patch: Partial<Omit<SupplyItem, "id">>) {
  const all = getSupplyItems();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(SUPPLY_KEY, all);
}

export function markSupplyOrdered(id: string) {
  updateSupplyItem(id, { lastOrderedAt: todayIso() });
}

// ---------- Unified shopping list ----------

export type ShoppingListRow = {
  key: string;
  id: string;
  kind: "bar" | "supply";
  name: { en: string; vi: string };
  unit: string;
  onHand: number;
  par: number;
  supplierId?: string;
  packSize?: string;
  packCostVnd: number | null;
  lastOrderedAt: string | null;
  markOrdered: () => void;
};

/** Everything below par, from both the bar's par-tracked stock and the kitchen supplies registry — computed fresh, never hand-maintained. */
export function getShoppingList(date = todayIso()): ShoppingListRow[] {
  const rows: ShoppingListRow[] = [];

  for (const item of getStockItems("bar")) {
    if (typeof item.par !== "number") continue;
    const onHand = getBarOnHand(item.id, date);
    if (onHand >= item.par) continue;
    const meta = getOrderingMeta(item.id);
    rows.push({
      key: `bar:${item.id}`,
      id: item.id,
      kind: "bar",
      name: item.name,
      unit: item.unit,
      onHand,
      par: item.par,
      supplierId: meta.supplierId,
      packSize: meta.packSize,
      packCostVnd: meta.packCostVnd,
      lastOrderedAt: meta.lastOrderedAt,
      markOrdered: () => markBarItemOrdered(item.id),
    });
  }

  for (const item of getSupplyItems()) {
    if (item.onHand >= item.par) continue;
    rows.push({
      key: `supply:${item.id}`,
      id: item.id,
      kind: "supply",
      name: item.name,
      unit: item.unit,
      onHand: item.onHand,
      par: item.par,
      supplierId: item.supplierId,
      packSize: item.packSize,
      packCostVnd: item.packCostVnd,
      lastOrderedAt: item.lastOrderedAt,
      markOrdered: () => markSupplyOrdered(item.id),
    });
  }

  return rows;
}

export function getUnconfirmedPricingCount(): number {
  return getShoppingList().filter((r) => r.packCostVnd === null).length;
}

/** Items not ordered in a long time — candidates for cleanup (dead SKU, or the supplier link is stale). */
export function getStaleOrderItems(staleDays = 60, today = todayIso()): ShoppingListRow[] {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - staleDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return getShoppingList().filter((r) => !r.lastOrderedAt || r.lastOrderedAt < cutoffIso);
}

export function supplierName(id: string | undefined): string {
  if (!id) return "—";
  return getSuppliers().find((s) => s.id === id)?.name ?? "—";
}
