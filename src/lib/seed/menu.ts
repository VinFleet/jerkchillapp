import type { MenuItem, PrintedMaterial } from "@/lib/types";

// Transcribed directly from the real printed menu (Menu A3 1408.pdf) — every
// name and price here matches what's actually printed, not the earlier
// operations-doc draft. dine_in and delivery share the same flat price
// since the menu prices dine-in and delivery the same; lunch_box stays null
// except on the Jerk Lunch Box item, which is takeaway-only. Jerk Sauce and
// the Escovitch pickles appear on the menu as condiment descriptions with no
// price attached, so they're intentionally not seeded as priced menu items.
// Discontinued items (Goat Curry, whole Fish/Fish Friday, Peach Cobbler) are
// intentionally not seeded as active menu items.

const updatedAt = new Date(0).toISOString();

export const SEED_MENU_ITEMS: MenuItem[] = [
  { id: "mi_jerk_chicken", name: { en: "Jerk Chicken", vi: "Gà Jerk" }, category: "main", recipeId: "rc_jerk_chicken", pricesVnd: { dine_in: 210000, delivery: 210000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_lunch_box", name: { en: "Jerk Lunch Box", vi: "Cơm Hộp Trưa Gà Jerk" }, category: "main", recipeId: "rc_jerk_chicken", pricesVnd: { dine_in: null, delivery: null, lunch_box: 170000 }, priceNote: { en: "Takeaway only, 12pm–3pm · Served with 2 sides, extra sides +35,000", vi: "Chỉ mang về, 12:00–15:00 · Kèm 2 món phụ, thêm món phụ +35.000" }, active: true, updatedAt },
  { id: "mi_fried_dumplings", name: { en: "Fried Dumplings", vi: "Bánh Bột Chiên" }, category: "side", recipeId: "rc_fried_dumplings", pricesVnd: { dine_in: 55000, delivery: 55000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_coleslaw", name: { en: "Coleslaw", vi: "Bắp Cải Trộn Mayonnaise" }, category: "side", pricesVnd: { dine_in: 55000, delivery: 55000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_mac_cheese", name: { en: "Mac and Cheese", vi: "Nui Sốt Phô Mai" }, category: "side", recipeId: "rc_mac_cheese", pricesVnd: { dine_in: 55000, delivery: 55000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_house_salad", name: { en: "House Salad", vi: "Salad Nhà Làm" }, category: "side", recipeId: "rc_house_salad", pricesVnd: { dine_in: 55000, delivery: 55000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_apple_crumble", name: { en: "Apple Crumble with Custard", vi: "Bánh táo ăn kèm sốt Custard" }, category: "dessert", recipeId: "rc_apple_crumble", pricesVnd: { dine_in: 75000, delivery: 75000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_roast_chicken", name: { en: "Sunday Roast", vi: "Sunday Roast" }, category: "roast_sunday", recipeId: "rc_roast_chicken", pricesVnd: { dine_in: 350000, delivery: null, lunch_box: null }, priceNote: { en: "Per person + unlimited soft drink/beer/mocktail refills, 2-person minimum, Sundays 12–3pm, book in advance", vi: "Theo người + làm đầy miễn phí nước ngọt/bia/mocktail, tối thiểu 2 khách, Chủ Nhật 12:00–15:00, cần đặt trước" }, active: true, updatedAt },
  { id: "mi_rum_punch", name: { en: "Classic Rum Punch", vi: "Rum Punch Cổ Điển" }, category: "cocktail", recipeId: "rc_rum_punch", pricesVnd: { dine_in: 130000, delivery: 130000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_passionfruit_colada", name: { en: "Passionfruit Colada", vi: "Passionfruit Colada" }, category: "cocktail", recipeId: "rc_passionfruit_colada", pricesVnd: { dine_in: 130000, delivery: 130000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_ginger_fizz", name: { en: "Jerk & Chill Ginger Fizz", vi: "Jerk & Chill Ginger Fizz" }, category: "cocktail", recipeId: "rc_ginger_fizz", pricesVnd: { dine_in: 130000, delivery: 130000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_pineapple_daiquiri", name: { en: "Spiced Pineapple Daiquiri", vi: "Spiced Pineapple Daiquiri" }, category: "cocktail", recipeId: "rc_pineapple_daiquiri", pricesVnd: { dine_in: 130000, delivery: 130000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_mocktail", name: { en: "Mocktail", vi: "Mocktail" }, category: "beverage", pricesVnd: { dine_in: 85000, delivery: 85000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_beer_huda", name: { en: "Beer — Huda", vi: "Bia Huda" }, category: "beverage", pricesVnd: { dine_in: 25000, delivery: 25000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_beer_tuborg", name: { en: "Beer — Tuborg Ice", vi: "Bia Tuborg Ice" }, category: "beverage", pricesVnd: { dine_in: 35000, delivery: 35000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_beer_1664", name: { en: "Beer — K Blanc", vi: "Bia K Blanc" }, category: "beverage", pricesVnd: { dine_in: 45000, delivery: 45000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_soft_drinks", name: { en: "Soft Drinks (Coke / Sprite / Fanta)", vi: "Nước Ngọt (Coke / Sprite / Fanta)" }, category: "beverage", pricesVnd: { dine_in: 25000, delivery: 25000, lunch_box: null }, active: true, updatedAt },
  { id: "mi_water", name: { en: "Water", vi: "Nước Suối" }, category: "beverage", pricesVnd: { dine_in: 15000, delivery: 15000, lunch_box: null }, active: true, updatedAt },
];

export const SEED_PRINTED_MATERIALS: PrintedMaterial[] = [
  { id: "pm_menu_dine_in", name: { en: "Printed Menu (Dine-in)", vi: "Menu In (Tại Chỗ)" }, par: 30, onHand: 0, reorderPoint: 10, toReprint: false },
  { id: "pm_roast_sunday_signage", name: { en: "Roast Sunday Table Signage", vi: "Bảng Bàn Roast Sunday" }, par: 10, onHand: 0, reorderPoint: 3, toReprint: false },
  { id: "pm_business_cards", name: { en: "Business Cards", vi: "Danh Thiếp" }, par: 200, onHand: 0, reorderPoint: 50, toReprint: false },
];
