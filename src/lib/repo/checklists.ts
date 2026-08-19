import type { ChecklistItem, ChecklistTick, ChecklistArea, ChecklistShift } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_CHECKLIST_ITEMS } from "@/lib/seed/checklists";

const ITEMS_KEY = "checklist_items";
const TICKS_KEY = "checklist_ticks";
// v2: dropped the "walk-in" from the kitchen closing item — there isn't one.
const RECONCILE_KEY = "checklist_items_reconcile_v2";

export function ensureChecklistsSeeded() {
  if (!isSeeded(ITEMS_KEY)) {
    writeList(ITEMS_KEY, SEED_CHECKLIST_ITEMS);
    markSeeded(ITEMS_KEY);
    markSeeded(RECONCILE_KEY);
    return;
  }
  // One-time reconciliation against the real Chef/FOH checklists (Chef's
  // Recipe Book) — the original seed here was a short placeholder list.
  // Replaces the old seed-origin items with the real, much longer ones,
  // while keeping any custom item a manager added via "Add item" (those get
  // ids from newId("cli"), distinct from the seed's "cl_..." ids).
  if (!isSeeded(RECONCILE_KEY)) {
    const all = readList<ChecklistItem>(ITEMS_KEY);
    const customItems = all.filter((i) => i.id.startsWith("cli_"));
    writeList(ITEMS_KEY, [...SEED_CHECKLIST_ITEMS, ...customItems]);
    markSeeded(RECONCILE_KEY);
  }
}

export function getChecklistItems(area?: ChecklistArea, shift?: ChecklistShift): ChecklistItem[] {
  let items = readList<ChecklistItem>(ITEMS_KEY).filter((i) => i.active);
  if (area) items = items.filter((i) => i.area === area);
  if (shift) items = items.filter((i) => i.shift === shift);
  return items.sort((a, b) => a.order - b.order);
}

export function addChecklistItem(area: ChecklistArea, shift: ChecklistShift, en: string, vi: string) {
  const all = readList<ChecklistItem>(ITEMS_KEY);
  const maxOrder = Math.max(0, ...all.filter((i) => i.area === area && i.shift === shift).map((i) => i.order));
  all.push({
    id: newId("cli"),
    area,
    shift,
    order: maxOrder + 1,
    active: true,
    text: { en, vi },
  });
  writeList(ITEMS_KEY, all);
}

export function removeChecklistItem(itemId: string) {
  const all = readList<ChecklistItem>(ITEMS_KEY);
  const idx = all.findIndex((i) => i.id === itemId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], active: false };
    writeList(ITEMS_KEY, all);
  }
}

function getAllTicks(): ChecklistTick[] {
  return readList<ChecklistTick>(TICKS_KEY);
}

export function getTicksForDate(date: string): ChecklistTick[] {
  return getAllTicks().filter((t) => t.date === date);
}

export function isChecked(itemId: string, date: string): ChecklistTick | undefined {
  return getAllTicks().find((t) => t.itemId === itemId && t.date === date);
}

export function toggleTick(itemId: string, date: string, checkedBy: string) {
  const all = getAllTicks();
  const idx = all.findIndex((t) => t.itemId === itemId && t.date === date);
  if (idx >= 0) {
    const next = !all[idx].checked;
    all[idx] = {
      ...all[idx],
      checked: next,
      checkedBy: next ? checkedBy : all[idx].checkedBy,
      checkedAt: next ? new Date().toISOString() : null,
    };
    writeList(TICKS_KEY, all);
    return all[idx];
  }
  const created: ChecklistTick = {
    id: newId("tick"),
    itemId,
    date,
    checked: true,
    checkedBy,
    checkedAt: new Date().toISOString(),
  };
  all.push(created);
  writeList(TICKS_KEY, all);
  return created;
}

export function getCompletion(area: ChecklistArea, shift: ChecklistShift, date: string) {
  const items = getChecklistItems(area, shift);
  const ticks = getTicksForDate(date);
  const done = items.filter((i) => ticks.find((t) => t.itemId === i.id && t.checked)).length;
  return { done, total: items.length };
}
