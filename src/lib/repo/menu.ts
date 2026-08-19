import type { MenuItem, MenuChannel, PrintedMaterial } from "@/lib/types";
import { readList, writeList, readValue, writeValue, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_MENU_ITEMS, SEED_PRINTED_MATERIALS } from "@/lib/seed/menu";

const MENU_KEY = "menu_items";
const REPRINT_FLAG_KEY = "menu_needs_reprint";
const MATERIALS_KEY = "printed_materials";
const COCKTAIL_RECIPE_LINK_KEY = "menu_cocktail_recipe_link_v1";
const KBLANC_NAME_FIX_KEY = "menu_kblanc_name_fix_v1";

export function ensureMenuSeeded() {
  if (!isSeeded(MENU_KEY)) {
    writeList(MENU_KEY, SEED_MENU_ITEMS);
    markSeeded(MENU_KEY);
  }
  if (!isSeeded(MATERIALS_KEY)) {
    writeList(MATERIALS_KEY, SEED_PRINTED_MATERIALS);
    markSeeded(MATERIALS_KEY);
  }
  // One-time migration: link the 3 new cocktail menu items to their real
  // Recipe Book entries (added after these menu items first seeded) without
  // touching any prices a manager may have already edited.
  if (!isSeeded(COCKTAIL_RECIPE_LINK_KEY)) {
    const all = readList<MenuItem>(MENU_KEY);
    let changed = false;
    for (const seedItem of SEED_MENU_ITEMS) {
      if (!seedItem.recipeId) continue;
      const idx = all.findIndex((m) => m.id === seedItem.id);
      if (idx >= 0 && !all[idx].recipeId) {
        all[idx] = { ...all[idx], recipeId: seedItem.recipeId };
        changed = true;
      }
    }
    if (changed) writeList(MENU_KEY, all);
    markSeeded(COCKTAIL_RECIPE_LINK_KEY);
  }
  // One-time migration: fix the third beer's name — it was briefly and
  // wrongly renamed to "1664" in an earlier pass; the Chef's Recipe Book's
  // own change log confirms "1664" was never a real product and the real
  // third beer is K Blanc. Only touches the name, never the price.
  if (!isSeeded(KBLANC_NAME_FIX_KEY)) {
    const all = readList<MenuItem>(MENU_KEY);
    const idx = all.findIndex((m) => m.id === "mi_beer_1664");
    if (idx >= 0 && all[idx].name.en !== "Beer — K Blanc") {
      all[idx] = { ...all[idx], name: { en: "Beer — K Blanc", vi: "Bia K Blanc" } };
      writeList(MENU_KEY, all);
    }
    markSeeded(KBLANC_NAME_FIX_KEY);
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
