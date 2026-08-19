import type { FridgeUnit, CleaningTask } from "@/lib/types";

// Only structural/reference data is seeded here (units, task list) — the
// logs themselves (readings, cook temps, deliveries, inspections, samples,
// pest sightings, complaints) are real legal records and start empty, filled
// in only by genuine use, same as the Stock day entries in Phase 1.
//
// Targets per the real Food Safety Book: fridges <=5C, freezers <=-18C.

export const SEED_FRIDGE_UNITS: FridgeUnit[] = [
  { id: "fu_walkin_fridge", name: { en: "Walk-in Fridge", vi: "Tủ Lạnh Lớn" }, kind: "fridge", targetMinC: 0, targetMaxC: 5, active: true },
  { id: "fu_walkin_freezer", name: { en: "Walk-in Freezer", vi: "Tủ Đông Lớn" }, kind: "freezer", targetMinC: -25, targetMaxC: -18, active: true },
  { id: "fu_prep_fridge", name: { en: "Prep Line Fridge", vi: "Tủ Lạnh Bàn Sơ Chế" }, kind: "fridge", targetMinC: 0, targetMaxC: 5, active: true },
  { id: "fu_bar_fridge", name: { en: "Bar Fridge", vi: "Tủ Lạnh Quầy Bar" }, kind: "fridge", targetMinC: 0, targetMaxC: 5, active: true },
];

// Areas and frequencies from the real Food Safety Book — rendered as a
// weekly grid (area x day), matching how it's actually used on the wall.
export const SEED_CLEANING_TASKS: CleaningTask[] = [
  { id: "ct_prep_surfaces", area: { en: "Food prep surfaces", vi: "Bề mặt sơ chế thực phẩm" }, frequency: "after_use", active: true },
  { id: "ct_chopping_boards", area: { en: "Chopping boards", vi: "Thớt" }, frequency: "after_use", active: true },
  { id: "ct_floors", area: { en: "Floors", vi: "Sàn nhà" }, frequency: "daily", active: true },
  { id: "ct_walkin_fridge", area: { en: "Walk-in fridge", vi: "Tủ lạnh lớn" }, frequency: "weekly", active: true },
  { id: "ct_extraction", area: { en: "Extraction hood / filters", vi: "Chụp hút mùi / bộ lọc" }, frequency: "monthly", active: true },
  { id: "ct_waste_bins", area: { en: "Waste bins", vi: "Thùng rác" }, frequency: "daily", active: true },
];
