import type { MenuItem, MenuChannel, PrintedMaterial } from "@/lib/types";
import { readList, writeList, readValue, writeValue, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_MENU_ITEMS, SEED_PRINTED_MATERIALS } from "@/lib/seed/menu";

const MENU_KEY = "menu_items";
const REPRINT_FLAG_KEY = "menu_needs_reprint";
const MATERIALS_KEY = "printed_materials";

export function ensureMenuSeeded() {
  if (!isSeeded(MENU_KEY)) {
    writeList(MENU_KEY, SEED_MENU_ITEMS);
    markSeeded(MENU_KEY);
  }
  if (!isSeeded(MATERIALS_KEY)) {
    writeList(MATERIALS_KEY, SEED_PRINTED_MATERIALS);
    markSeeded(MATERIALS_KEY);
  }
}

export function getMenuItems(activeOnly = true): MenuItem[] {
  const all = readList<MenuItem>(MENU_KEY);
  return activeOnly ? all.filter((m) => m.active) : all;
}

export function addMenuItem(name: string, category: MenuItem["category"]): MenuItem {
  const entry: MenuItem = {
    id: newId("menu"),
    name: { en: name, vi: name },
    category,
    pricesVnd: { dine_in: null, delivery: null, lunch_box: null },
    active: true,
    updatedAt: new Date().toISOString(),
  };
  const all = readList<MenuItem>(MENU_KEY);
  all.push(entry);
  writeList(MENU_KEY, all);
  return entry;
}

/** Editing a price flags a reprint is needed — cleared once the reprint is done. */
export function updateMenuItemPrice(id: string, channel: MenuChannel, priceVnd: number | null) {
  const all = readList<MenuItem>(MENU_KEY);
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const changed = all[idx].pricesVnd[channel] !== priceVnd;
  all[idx] = {
    ...all[idx],
    pricesVnd: { ...all[idx].pricesVnd, [channel]: priceVnd },
    updatedAt: new Date().toISOString(),
  };
  writeList(MENU_KEY, all);
  if (changed && channel === "dine_in") setReprintFlag(true);
}

export function getReprintFlag(): boolean {
  return readValue<boolean>(REPRINT_FLAG_KEY, false);
}

export function setReprintFlag(value: boolean) {
  writeValue(REPRINT_FLAG_KEY, value);
}

// ---------- Menu & Printed Materials Stock ----------

export function getPrintedMaterials(): PrintedMaterial[] {
  return readList<PrintedMaterial>(MATERIALS_KEY);
}

export function updatePrintedMaterial(id: string, patch: Partial<Omit<PrintedMaterial, "id">>) {
  const all = readList<PrintedMaterial>(MATERIALS_KEY);
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(MATERIALS_KEY, all);
}
