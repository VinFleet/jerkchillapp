import type { StockItem } from "@/lib/types";

export const SEED_STOCK_ITEMS: StockItem[] = [
  // Kitchen — mains & sides, produced fresh daily
  { id: "st_jerk_chicken", name: { en: "Jerk Chicken (portions)", vi: "Gà Jerk (khẩu phần)" }, section: "kitchen", unit: "portion", prepCategory: "main", recipeId: "rc_jerk_chicken" },
  { id: "st_rice_peas", name: { en: "Rice and Peas", vi: "Cơm Đậu" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_rice_peas" },
  { id: "st_steamed_veg", name: { en: "Steamed Veg", vi: "Rau Củ Hấp" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_steamed_veg" },
  { id: "st_plantain", name: { en: "Plantain", vi: "Chuối Chiên" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_plantain" },
  { id: "st_fried_dumplings", name: { en: "Fried Dumplings", vi: "Bánh Bột Chiên" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_fried_dumplings" },
  { id: "st_mac_cheese", name: { en: "Mac and Cheese", vi: "Mì Ống Phô Mai" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_mac_cheese" },
  { id: "st_house_salad", name: { en: "House Salad", vi: "Salad Nhà Làm" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_house_salad" },
  { id: "st_apple_crumble", name: { en: "Apple Crumble", vi: "Bánh Táo Nướng Giòn" }, section: "kitchen", unit: "portion", prepCategory: "dessert", recipeId: "rc_apple_crumble" },
  { id: "st_custard", name: { en: "Custard", vi: "Sốt Custard" }, section: "kitchen", unit: "portion", prepCategory: "dessert", recipeId: "rc_custard" },
  // Added from the real Daily Stock & Production Log table (Chef's Recipe
  // Book) — that table also still lists "Peach Cobbler", but that dish was
  // discontinued per the book's own change log (#71) and is intentionally
  // left out here as a stale leftover row in the source, not a real item.
  { id: "st_jerk_sauce", name: { en: "Jerk Sauce", vi: "Sốt Jerk" }, section: "kitchen", unit: "portion", prepCategory: "main" },
  { id: "st_coleslaw", name: { en: "Coleslaw", vi: "Bắp Cải Trộn Mayonnaise" }, section: "kitchen", unit: "portion", prepCategory: "side" },
  { id: "st_pickled_veg", name: { en: "Pickled Veg", vi: "Rau Củ Ngâm Chua" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_pickled_veg" },
  { id: "st_spicy_pickles", name: { en: "Spicy Pickles", vi: "Dưa Chua Cay" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_spicy_pickles" },
  { id: "st_chilli_sauce", name: { en: "Chilli Sauce", vi: "Sốt Ớt" }, section: "kitchen", unit: "portion", prepCategory: "side" },
  { id: "st_escovitch_cold", name: { en: "Fresh Pickled Escovitch Sauce", vi: "Sốt Escovitch Ngâm Lạnh" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_escovitch_cold" },
  { id: "st_escovitch_hot", name: { en: "Hot Pickled Escovitch Sauce", vi: "Sốt Escovitch Ngâm Cay" }, section: "kitchen", unit: "portion", prepCategory: "side", recipeId: "rc_escovitch_hot" },

  // Bar — par-tracked
  { id: "st_white_rum", name: { en: "White Rum (Bacardi)", vi: "Rum Trắng (Bacardi)" }, section: "bar", unit: "bottle (700ml)", par: 4, costPerUnitVnd: 500000 },
  { id: "st_dark_rum", name: { en: "Dark Rum", vi: "Rum Đen" }, section: "bar", unit: "bottle (700ml)", par: 2 },
  { id: "st_spiced_rum", name: { en: "Spiced Rum", vi: "Rum Gia Vị" }, section: "bar", unit: "bottle (700ml)", par: 2 },
  { id: "st_beer_huda", name: { en: "Beer — Huda", vi: "Bia Huda" }, section: "bar", unit: "can", par: 48, costPerUnitVnd: 25000 },
  { id: "st_beer_tuborg", name: { en: "Beer — Tuborg Ice", vi: "Bia Tuborg Ice" }, section: "bar", unit: "can", par: 48, costPerUnitVnd: 35000 },
  { id: "st_beer_kblanc", name: { en: "Beer — K Blanc", vi: "Bia K Blanc" }, section: "bar", unit: "can", par: 24, costPerUnitVnd: 45000 },
  { id: "st_soft_drinks", name: { en: "Soft Drinks (Coke/Sprite/Fanta)", vi: "Nước Ngọt (Coke/Sprite/Fanta)" }, section: "bar", unit: "can", par: 60, costPerUnitVnd: 25000 },
  { id: "st_water", name: { en: "Bottled Water", vi: "Nước Suối" }, section: "bar", unit: "bottle", par: 48, costPerUnitVnd: 15000 },
  { id: "st_lime", name: { en: "Lime (garnish)", vi: "Chanh (trang trí)" }, section: "bar", unit: "kg", par: 2 },
  { id: "st_mint", name: { en: "Mint (garnish)", vi: "Bạc Hà (trang trí)" }, section: "bar", unit: "bunch", par: 3 },
  { id: "st_ginger_beer", name: { en: "Ginger Beer", vi: "Bia Gừng" }, section: "bar", unit: "bottle", par: 12 },
];
