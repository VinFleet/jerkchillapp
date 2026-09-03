import { readList, writeList, getActiveTenant } from "@/lib/storage";
import { supabase } from "@/lib/supabase/client";
import { STARTER_EQUIPMENT_CATALOG } from "@/lib/seed/equipmentCatalog";
import type { EquipmentCatalogEntry, EquipmentCategory } from "@/lib/types";

/**
 * The shared fridge/freezer catalog, cached the same way the floor plan is
 * (lib/repo/tableCache.ts): it lives in Postgres because it belongs to the
 * whole platform, not one branch, and this mirrors it locally so the "add a
 * fridge" screen still has something useful to search offline. The compiled
 * starter list is the fallback for a device that has never once fetched it.
 */

const CACHE_KEY = "equipment_catalog_cache";

export function getEquipmentCatalog(): EquipmentCatalogEntry[] {
  const cached = readList<EquipmentCatalogEntry>(CACHE_KEY);
  return cached.length > 0 ? cached : STARTER_EQUIPMENT_CATALOG;
}

/** Pull the live catalog and cache it. Safe to call often; a no-op offline. */
export async function refreshEquipmentCatalog(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("equipment_catalog")
    .select("id, category, brand, model, capacity_liters, target_min_c, target_max_c, notes")
    .eq("active", true)
    .order("brand");
  if (error || !data || data.length === 0) return;
  const entries: EquipmentCatalogEntry[] = data.map((row) => ({
    id: row.id as string,
    category: row.category as EquipmentCategory,
    brand: row.brand as string,
    model: row.model as string,
    capacityLiters: (row.capacity_liters as number | null) ?? null,
    targetMinC: Number(row.target_min_c),
    targetMaxC: Number(row.target_max_c),
    notes: (row.notes as string | null) ?? undefined,
  }));
  writeList(CACHE_KEY, entries);
}

/**
 * Tell the platform about a fridge nobody catalogued yet.
 *
 * Fire-and-forget, same reasoning as printing: the equipment gets added to
 * this branch's log either way, so a network failure here must not block
 * the person standing in the kitchen from finishing their entry.
 */
export async function submitEquipmentSuggestion(input: {
  category: EquipmentCategory;
  brand: string;
  model: string;
  capacityLiters?: number;
  note?: string;
  submittedBy?: string | null;
}): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("equipment_suggestions")
    .insert({
      tenant_id: getActiveTenant(),
      category: input.category,
      brand: input.brand.trim(),
      model: input.model.trim(),
      capacity_liters: input.capacityLiters ?? null,
      note: input.note?.trim() || null,
      submitted_by: input.submittedBy ?? null,
    })
    .then(
      () => undefined,
      () => undefined
    );
}
