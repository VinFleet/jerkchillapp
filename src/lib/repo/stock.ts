import type { StockItem, StockDayEntry, StockSection, WasteLogEntry, WasteReason } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso, isLegacyTenant } from "@/lib/storage";
import { SEED_STOCK_ITEMS } from "@/lib/seed/stock";
import { getRecipe } from "@/lib/repo/recipes";

// v2: corrected the K Blanc -> 1664 beer name (this rename turned out to be
// backwards — see v3). v3: reverted back to K Blanc — the Chef's Recipe
// Book's own change log confirms "1664" was never a real product on this
// menu and K Blanc is the actual third beer. Bumping the key forces a fresh
// reseed of item definitions for browsers that already loaded either wrong
// name — day entries live under a separate key (ENTRIES_KEY) and are
// unaffected, and item names/pars aren't user-editable anywhere, so nothing
// real gets lost.
const ITEMS_KEY = "stock_items_v3";
const ENTRIES_KEY = "stock_entries";

export function ensureStockSeeded() {
  // Jerk & Chill's data belongs to Jerk & Chill. A neutral branch starts
  // empty here and its owner builds their own — the seed below is customer
  // number one's restaurant, not a template.
  if (!isLegacyTenant()) {
    markSeeded(ITEMS_KEY);
    return;
  }

  if (isSeeded(ITEMS_KEY)) return;
  writeList(ITEMS_KEY, SEED_STOCK_ITEMS);
  markSeeded(ITEMS_KEY);
}

export function getStockItems(section?: StockSection): StockItem[] {
  const all = readList<StockItem>(ITEMS_KEY);
  return section ? all.filter((i) => i.section === section) : all;
}

export function getStockItem(id: string): StockItem | undefined {
  return getStockItems().find((i) => i.id === id);
}

function getAllEntries(): StockDayEntry[] {
  return readList<StockDayEntry>(ENTRIES_KEY);
}

export function getEntry(itemId: string, date: string): StockDayEntry | undefined {
  return getAllEntries().find((e) => e.itemId === itemId && e.date === date);
}

export function getEntriesForDate(date: string): StockDayEntry[] {
  return getAllEntries().filter((e) => e.date === date);
}

/** Most recent entries for an item, most recent first, excluding the given date. */
export function getRecentEntries(itemId: string, beforeDate: string, limit = 7): StockDayEntry[] {
  return getAllEntries()
    .filter((e) => e.itemId === itemId && e.date < beforeDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

/**
 * Get-or-create today's entry, auto-carrying yesterday's Closing Stock into
 * today's Opening Stock so nobody has to re-key it.
 */
export function getOrCreateEntry(itemId: string, date: string, enteredBy: string): StockDayEntry {
  const existing = getEntry(itemId, date);
  if (existing) return existing;

  // If nobody recorded yesterday's closing count, carrying "0" forward would
  // quietly assert the kitchen ended with nothing — and today's production
  // plan is built on this number. Carry null instead so the screen can say
  // "not counted" rather than inventing a zero.
  const [previous] = getRecentEntries(itemId, date, 1);
  const opening = previous ? previous.closing ?? 0 : 0;
  const openingUncounted = Boolean(previous && previous.closing === null);

  const fresh: StockDayEntry = {
    id: newId("stk"),
    itemId,
    date,
    opening,
    openingUncounted,
    produced: 0,
    closing: null,
    enteredBy,
    updatedAt: new Date().toISOString(),
  };
  const all = getAllEntries();
  all.push(fresh);
  writeList(ENTRIES_KEY, all);
  return fresh;
}

export function updateEntry(
  itemId: string,
  date: string,
  patch: Partial<Pick<StockDayEntry, "opening" | "produced" | "closing">>,
  enteredBy: string
) {
  getOrCreateEntry(itemId, date, enteredBy);
  const all = getAllEntries();
  const idx = all.findIndex((e) => e.itemId === itemId && e.date === date);
  all[idx] = { ...all[idx], ...patch, enteredBy, updatedAt: new Date().toISOString() };
  writeList(ENTRIES_KEY, all);
  return all[idx];
}

/** Waste flag: closing stock left over 3+ nights running for the same item. */
export function getWasteStreak(itemId: string, date: string): number {
  const recent = getRecentEntries(itemId, date, 5);
  let streak = 0;
  for (const e of recent) {
    if (e.closing !== null && e.closing > 0) streak += 1;
    else break;
  }
  return streak;
}

export function getBarOnHand(itemId: string, date = todayIso()): number {
  const entry = getEntry(itemId, date) ?? getRecentEntries(itemId, date, 1)[0];
  if (!entry) return 0;
  return entry.closing ?? entry.opening + entry.produced;
}

// ---------- Waste Log ----------
// Explicit "this got thrown away" records, separate from the leftover-streak
// inference above — captures why, and cost in VND when the item has cost
// data on file.

const WASTE_KEY = "stock_waste_log";

export function costPerUnitFor(item: StockItem): number | null {
  if (item.costPerUnitVnd != null) return item.costPerUnitVnd;
  if (item.recipeId) return getRecipe(item.recipeId)?.costPerPortionVnd ?? null;
  return null;
}

export function logWaste(itemId: string, date: string, qty: number, reason: WasteReason, loggedBy: string, note?: string): WasteLogEntry {
  const item = getStockItem(itemId);
  const perUnit = item ? costPerUnitFor(item) : null;
  const entry: WasteLogEntry = {
    id: newId("waste"),
    itemId,
    date,
    qty,
    reason,
    note: note?.trim() || undefined,
    costVnd: perUnit != null ? Math.round(perUnit * qty) : null,
    loggedBy,
    loggedAt: new Date().toISOString(),
  };
  const all = readList<WasteLogEntry>(WASTE_KEY);
  all.push(entry);
  writeList(WASTE_KEY, all);
  return entry;
}

export function getWasteLog(limit = 200): WasteLogEntry[] {
  return readList<WasteLogEntry>(WASTE_KEY)
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1))
    .slice(0, limit);
}

export function getWasteForDate(date: string): WasteLogEntry[] {
  return readList<WasteLogEntry>(WASTE_KEY).filter((w) => w.date === date);
}

export function getWasteInRange(fromDate: string, toDate: string): WasteLogEntry[] {
  return readList<WasteLogEntry>(WASTE_KEY).filter((w) => w.date >= fromDate && w.date <= toDate);
}

export function wasteTotalVnd(entries: WasteLogEntry[]): number {
  return entries.reduce((sum, w) => sum + (w.costVnd ?? 0), 0);
}
