import type { MenuItem, MenuChannel, PrintedMaterial, Bi } from "@/lib/types";
import { readList, writeList, readValue, writeValue, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_MENU_ITEMS, SEED_PRINTED_MATERIALS } from "@/lib/seed/menu";

const MENU_KEY = "menu_items";
const REPRINT_FLAG_KEY = "menu_needs_reprint";
const MATERIALS_KEY = "printed_materials";
const COCKTAIL_RECIPE_LINK_KEY = "menu_cocktail_recipe_link_v1";
const KBLANC_NAME_FIX_KEY = "menu_kblanc_name_fix_v1";
const OPTIONS_AND_DRINKS_KEY = "menu_options_and_drinks_v1";

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
  // One-time migration: the questions asked at the table, and one row per
  // soft drink.
  //
  // Three changes, none of which may touch a price a manager has edited:
  //
  //  - Jerk Chicken and the Lunch Box gain the spice question, and every
  //    cocktail gains cocktail-or-mocktail. Options are copied from the seed
  //    only where the item has none, so a manager who has since edited them
  //    keeps their version.
  //  - The standalone Mocktail becomes a choice on each cocktail, so the item
  //    is retired. Deactivated rather than deleted: it may sit on orders
  //    already taken, and a bill that loses its item name is unreadable.
  //  - "Soft Drinks (Coke / Sprite / Fanta)" becomes Coca-Cola, Sprite and
  //    Fanta. The old row is likewise retired rather than removed, and the
  //    three new ones inherit its price if it was changed from the seed —
  //    otherwise a corrected price would be silently undone.
  if (!isSeeded(OPTIONS_AND_DRINKS_KEY)) {
    const all = readList<MenuItem>(MENU_KEY);
    let changed = false;

    for (const seedItem of SEED_MENU_ITEMS) {
      if (!seedItem.options?.length) continue;
      const idx = all.findIndex((m) => m.id === seedItem.id);
      if (idx >= 0 && !all[idx].options?.length) {
        all[idx] = { ...all[idx], options: seedItem.options, updatedAt: new Date().toISOString() };
        changed = true;
      }
    }

    const retire = (id: string) => {
      const idx = all.findIndex((m) => m.id === id);
      if (idx >= 0 && all[idx].active) {
        all[idx] = { ...all[idx], active: false, updatedAt: new Date().toISOString() };
        changed = true;
      }
      return idx >= 0 ? all[idx] : undefined;
    };

    retire("mi_mocktail");
    const oldSoftDrinks = retire("mi_soft_drinks");

    // Carry across a price someone actually set, rather than resetting to seed.
    const inheritedPrice = oldSoftDrinks?.pricesVnd;
    for (const id of ["mi_coke", "mi_sprite", "mi_fanta"]) {
      if (all.some((m) => m.id === id)) continue;
      const seedItem = SEED_MENU_ITEMS.find((m) => m.id === id);
      if (!seedItem) continue;
      all.push(
        inheritedPrice && inheritedPrice.dine_in !== 25000
          ? { ...seedItem, pricesVnd: inheritedPrice, updatedAt: new Date().toISOString() }
          : { ...seedItem, updatedAt: new Date().toISOString() }
      );
      changed = true;
    }

    if (changed) writeList(MENU_KEY, all);
    markSeeded(OPTIONS_AND_DRINKS_KEY);
  }
}

export function getMenuItems(activeOnly = true): MenuItem[] {
  const all = readList<MenuItem>(MENU_KEY);
  return activeOnly ? all.filter((m) => m.active) : all;
}

/** `recipeId` is what makes cost and margin work, so it's collected up front — an item added without it can be linked later with updateMenuItem. */
export function addMenuItem(name: Bi, category: MenuItem["category"], recipeId?: string): MenuItem {
  const entry: MenuItem = {
    id: newId("menu"),
    name,
    category,
    recipeId,
    pricesVnd: { dine_in: null, delivery: null, lunch_box: null },
    active: true,
    updatedAt: new Date().toISOString(),
  };
  const all = readList<MenuItem>(MENU_KEY);
  all.push(entry);
  writeList(MENU_KEY, all);
  return entry;
}

/**
 * Edits everything about an item except its prices (those go through
 * updateMenuItemPrice). A name or category change means the printed menu no
 * longer matches, so it flags a reprint the same way a dine-in price change does.
 */
export function updateMenuItem(id: string, patch: { name?: Bi; category?: MenuItem["category"]; recipeId?: string }) {
  const all = readList<MenuItem>(MENU_KEY);
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const prev = all[idx];
  all[idx] = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  writeList(MENU_KEY, all);
  const nameChanged = patch.name !== undefined && (patch.name.en !== prev.name.en || patch.name.vi !== prev.name.vi);
  const categoryChanged = patch.category !== undefined && patch.category !== prev.category;
  if (nameChanged || categoryChanged) setReprintFlag(true);
}

/** Discontinued items are hidden, never deleted — old prices stay on record. Taking an item off the menu also means a reprint is due. */
export function setMenuItemActive(id: string, active: boolean) {
  const all = readList<MenuItem>(MENU_KEY);
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0 || all[idx].active === active) return;
  all[idx] = { ...all[idx], active, updatedAt: new Date().toISOString() };
  writeList(MENU_KEY, all);
  setReprintFlag(true);
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
