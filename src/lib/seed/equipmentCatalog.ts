import type { EquipmentCatalogEntry } from "@/lib/types";

/**
 * The device that has never been online still needs a usable dropdown.
 *
 * A short, real slice of the full catalog (which lives in Postgres and grows
 * from equipment_suggestions) — enough to get someone through their first
 * fridge before a fetch ever succeeds. Never Jerk & Chill's private data;
 * this is the same shared list every branch eventually pulls from the
 * server, just the seed of it.
 */
export const STARTER_EQUIPMENT_CATALOG: EquipmentCatalogEntry[] = [
  { id: "sanaky-vh-2599w1", category: "freezer", brand: "Sanaky", model: "VH-2599W1 (1 cửa)", capacityLiters: 208, targetMinC: -22, targetMaxC: -18 },
  { id: "sanaky-vh-2899w1", category: "fridge", brand: "Sanaky", model: "VH-2899W1 (tủ mát)", capacityLiters: 280, targetMinC: 0, targetMaxC: 5 },
  { id: "alaska-kc-210", category: "freezer", brand: "Alaska", model: "KC-210", capacityLiters: 400, targetMinC: -22, targetMaxC: -18 },
  { id: "sanden-sps-0350p", category: "fridge", brand: "Sanden Intercool", model: "SPS-0350P", capacityLiters: 365, targetMinC: 0, targetMaxC: 5 },
];
