import type { FridgeUnit, CleaningTask } from "@/lib/types";

// Only structural/reference data is seeded here (units, task list) — the
// logs themselves (readings, cook temps, deliveries, inspections, samples,
// pest sightings, complaints) are real legal records and start empty, filled
// in only by genuine use, same as the Stock day entries in Phase 1.
//
// Targets per the real Food Safety Book: fridges <=5C, freezers -25 to -18C.
// The real units on site — no walk-in, no generic placeholders.

export const SEED_FRIDGE_UNITS: FridgeUnit[] = [
  { id: "fu_drinks_fridge", name: { en: "Drinks Fridge", vi: "Tủ Lạnh Đồ Uống" }, kind: "fridge", targetMinC: 0, targetMaxC: 5, active: true },
  { id: "fu_under_counter_freezer", name: { en: "Under Counter Freezer", vi: "Tủ Đông Dưới Quầy" }, kind: "freezer", targetMinC: -25, targetMaxC: -18, active: true },
  { id: "fu_fridge_1_kitchen", name: { en: "Fridge 1 (Kitchen)", vi: "Tủ Lạnh 1 (Bếp)" }, kind: "fridge", targetMinC: 0, targetMaxC: 5, active: true },
  { id: "fu_fridge_2_kitchen", name: { en: "Fridge 2 (Kitchen)", vi: "Tủ Lạnh 2 (Bếp)" }, kind: "fridge", targetMinC: 0, targetMaxC: 5, active: true },
];

// Areas and frequencies from the real Food Safety Book — rendered as a
// weekly grid (area x day), matching how it's actually used on the wall.
export const SEED_CLEANING_TASKS: CleaningTask[] = [
  { id: "ct_prep_surfaces", area: { en: "Food prep surfaces", vi: "Bề mặt sơ chế thực phẩm" }, frequency: "after_use", active: true },
  { id: "ct_chopping_boards", area: { en: "Chopping boards", vi: "Thớt" }, frequency: "after_use", active: true },
  { id: "ct_floors", area: { en: "Floors", vi: "Sàn nhà" }, frequency: "daily", active: true },
  { id: "ct_walkin_fridge", area: { en: "Walk-in fridge", vi: "Kho lạnh" }, frequency: "weekly", active: true },
  { id: "ct_extraction", area: { en: "Extraction hood / filters", vi: "Chụp hút mùi / bộ lọc" }, frequency: "monthly", active: true },
  { id: "ct_waste_bins", area: { en: "Waste bins", vi: "Thùng rác" }, frequency: "daily", active: true },
];
