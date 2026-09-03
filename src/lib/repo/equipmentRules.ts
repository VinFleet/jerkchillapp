import type { EquipmentCategory } from "@/lib/types";

/**
 * The judgement calls in adding a fridge or freezer — kept pure and
 * import-free so they are testable without a browser or a catalog fetch.
 */

/** A sensible starting temperature band per category, before anyone edits it. */
export function defaultTargetRangeC(category: EquipmentCategory): { minC: number; maxC: number } {
  if (category === "freezer") return { minC: -22, maxC: -18 };
  if (category === "combo") return { minC: -18, maxC: 5 };
  return { minC: 0, maxC: 5 };
}

export type CustomEquipmentInput = {
  brand: string;
  model: string;
  capacityLiters?: number;
  minC: number;
  maxC: number;
};

export type EquipmentVerdict =
  | { ok: true }
  | { ok: false; reason: "brand" | "model" | "range" | "capacity" };

/**
 * Whether a hand-typed fridge is sane enough to log readings against.
 *
 * Brand and model are required — "Fridge" with no maker is not a fact
 * anyone downstream (a repair call-out, a suggestion the platform might add
 * to the catalog) can act on. The range check is the one that matters most:
 * min >= max would make every future reading both in range and out of range
 * at once, and the temperature log exists to say clearly which is true.
 */
export function validateCustomEquipment(input: CustomEquipmentInput): EquipmentVerdict {
  if (!input.brand.trim()) return { ok: false, reason: "brand" };
  if (!input.model.trim()) return { ok: false, reason: "model" };
  if (input.capacityLiters !== undefined && (!Number.isFinite(input.capacityLiters) || input.capacityLiters <= 0)) {
    return { ok: false, reason: "capacity" };
  }
  if (!Number.isFinite(input.minC) || !Number.isFinite(input.maxC) || input.minC >= input.maxC) {
    return { ok: false, reason: "range" };
  }
  return { ok: true };
}

/** "Sanaky VH-2599W1 · 208L" — the line shown once a unit has catalog data. */
export function equipmentSummary(brand?: string, model?: string, capacityLiters?: number | null): string | null {
  if (!brand && !model) return null;
  const name = [brand, model].filter(Boolean).join(" ");
  return capacityLiters ? `${name} · ${capacityLiters}L` : name;
}
