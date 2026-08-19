import type { StockItem, StockDayEntry, StockSection } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso } from "@/lib/storage";
import { SEED_STOCK_ITEMS } from "@/lib/seed/stock";

// v2: corrected the K Blanc -> 1664 beer name to match the real menu.
// Bumping the key forces a fresh reseed of item definitions for browsers
// that already loaded the old name — day entries live under a separate
// key (ENTRIES_KEY) and are unaffected, and item names/pars aren't
// user-editable anywhere, so nothing real gets lost.
const ITEMS_KEY = "stock_items_v2";
const ENTRIES_KEY = "stock_entries";

export function ensureStockSeeded() {
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

  const [previous] = getRecentEntries(itemId, date, 1);
  const opening = previous?.closing ?? 0;

  const fresh: StockDayEntry = {
    id: newId("stk"),
    itemId,
    date,
    opening,
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
