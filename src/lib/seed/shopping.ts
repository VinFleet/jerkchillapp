import type { SupplyItem } from "@/lib/types";

// The real Ingredient Ordering Checklist from the Chef's Recipe Book — every
// active ingredient across the book (~75 items, 8 categories), with real
// source, pack size, and pack cost where the book has it. Items the book
// itself marks "Nominal — confirm real supplier" don't get a supplierId
// (no vendor confirmed yet) even where a benchmark price is given; par
// levels are reasonable working defaults (like the Phase 1 bar par levels),
// this restaurant never has just one supplier — see suppliers seed. Kitchen
// & packaging supplies (charcoal, boxes, soap) aren't food ingredients so
// they're not in the book's checklist, but stay tracked here since they're
// real recurring orders too.

export const SEED_SUPPLY_ITEMS: SupplyItem[] = [
  // ---------- Fresh Produce ----------
  { id: "sup_yellow_onion", name: { en: "Yellow Onion", vi: "Hành Tây Vàng" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 21000, unit: "kg", par: 8, onHand: 0, lastOrderedAt: null },
  { id: "sup_red_onion", name: { en: "Red Onion", vi: "Hành Tây Tím" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 26250, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },
  { id: "sup_garlic", name: { en: "Garlic, peeled", vi: "Tỏi bóc vỏ" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 54600, unit: "kg", par: 3, onHand: 0, lastOrderedAt: null },
  { id: "sup_fresh_ginger", name: { en: "Fresh Ginger", vi: "Gừng Tươi" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 34650, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_fresh_thyme", name: { en: "Fresh Thyme", vi: "Lá Xạ Hương Tươi (Thyme)" }, supplierId: "sup_kamereo", packSize: "100g", packCostVnd: 27300, unit: "pack", par: 6, onHand: 0, lastOrderedAt: null },
  { id: "sup_rosemary", name: { en: "Rosemary", vi: "Hương Thảo" }, supplierId: "sup_kamereo", packSize: "100g", packCostVnd: 32550, unit: "pack", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_cabbage", name: { en: "Cabbage", vi: "Bắp Cải" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 15750, unit: "kg", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_carrot", name: { en: "Carrot", vi: "Cà Rốt" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 16800, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },
  { id: "sup_cauliflower", name: { en: "Cauliflower", vi: "Súp Lơ Trắng" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 44100, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_cucumber", name: { en: "Cucumber", vi: "Dưa Leo" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 17850, unit: "kg", par: 3, onHand: 0, lastOrderedAt: null },
  { id: "sup_cherry_tomato", name: { en: "Cherry Tomato (Red)", vi: "Cà Chua Bi (Đỏ)" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 45150, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_bell_pepper_green", name: { en: "Bell Pepper (Green)", vi: "Ớt Chuông Xanh" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 44100, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_bell_pepper_red", name: { en: "Red Bell Pepper", vi: "Ớt Chuông Đỏ" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 80850, unit: "kg", par: 3, onHand: 0, lastOrderedAt: null },
  { id: "sup_bell_pepper_yellow", name: { en: "Yellow Bell Pepper", vi: "Ớt Chuông Vàng" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 86100, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_scotch_bonnet", name: { en: "Scotch Bonnet Pepper", vi: "Ớt Scotch Bonnet" }, packSize: "1kg", packCostVnd: 690000, unit: "kg", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_pineapple", name: { en: "Pineapple", vi: "Dứa" }, supplierId: "sup_kamereo", packSize: "1kg, regular grade", packCostVnd: 18900, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },
  { id: "sup_lettuce", name: { en: "Lettuce", vi: "Xà Lách" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 40950, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_passion_fruit", name: { en: "Passion Fruit, fresh", vi: "Chanh Dây Tươi" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 38850, unit: "kg", par: 3, onHand: 0, lastOrderedAt: null },
  { id: "sup_lime", name: { en: "Lime (fresh, juiced in-house)", vi: "Chanh Tươi (vắt tại bếp)" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 13650, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },
  { id: "sup_plantain", name: { en: "Plantain (Chuối Già)", vi: "Chuối Già" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 21000, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },
  { id: "sup_potato", name: { en: "Potato, peeled & packed, big size", vi: "Khoai Tây Gọt Vỏ Đóng Gói (cỡ lớn)" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 25200, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },

  // ---------- Meat ----------
  { id: "sup_chicken_legs", name: { en: "Chicken Leg Quarters (CP Chicken, fresh)", vi: "Đùi Gà Nguyên (CP Chicken, tươi)" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 90000, unit: "kg", par: 40, onHand: 0, lastOrderedAt: null },
  { id: "sup_goat_meat", name: { en: "Goat Meat, bone-in diced — not currently on menu", vi: "Thịt Dê có xương, cắt hạt lựu — chưa có trên thực đơn" }, packSize: "1kg", packCostVnd: 345000, unit: "kg", par: 0, onHand: 0, lastOrderedAt: null },

  // ---------- Dairy & Cheese ----------
  { id: "sup_butter", name: { en: "Butter", vi: "Bơ" }, supplierId: "sup_kamereo", packSize: "200g", packCostVnd: 58320, unit: "pack", par: 10, onHand: 0, lastOrderedAt: null },
  { id: "sup_cream", name: { en: "Cream", vi: "Kem Tươi" }, supplierId: "sup_kamereo", packSize: "1L", packCostVnd: 206280, unit: "L", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_whole_milk", name: { en: "Whole Milk", vi: "Sữa Tươi Nguyên Kem" }, supplierId: "sup_kamereo", packSize: "1L", packCostVnd: 32400, unit: "L", par: 6, onHand: 0, lastOrderedAt: null },
  { id: "sup_cheddar", name: { en: "Cheddar Cheese", vi: "Phô Mai Cheddar" }, supplierId: "sup_kamereo", packSize: "200g", packCostVnd: 75600, unit: "pack", par: 10, onHand: 0, lastOrderedAt: null },
  { id: "sup_red_cheddar", name: { en: "Red Cheddar Cheese", vi: "Phô Mai Cheddar Đỏ" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 276480, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_parmesan", name: { en: "Parmesan", vi: "Phô Mai Parmesan" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 440856, unit: "kg", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_feta", name: { en: "Feta Cheese", vi: "Phô Mai Feta" }, packSize: "1kg", packCostVnd: 300000, unit: "kg", par: 0, onHand: 0, lastOrderedAt: null },
  { id: "sup_coconut_milk", name: { en: "Coconut Milk", vi: "Nước Cốt Dừa" }, supplierId: "sup_kamereo", packSize: "1L", packCostVnd: 62640, unit: "L", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_coconut_cream", name: { en: "Coconut Cream", vi: "Kem Dừa" }, supplierId: "sup_kamereo", packSize: "400ml", packCostVnd: 32400, unit: "pack", par: 4, onHand: 0, lastOrderedAt: null },

  // ---------- Dry Goods & Pantry ----------
  { id: "sup_plain_flour", name: { en: "Plain Flour", vi: "Bột Mì Đa Dụng" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 23220, unit: "kg", par: 6, onHand: 0, lastOrderedAt: null },
  { id: "sup_macaroni", name: { en: "Macaroni (dry)", vi: "Nui Ống (khô)" }, supplierId: "sup_kamereo", packSize: "400g", packCostVnd: 25920, unit: "pack", par: 8, onHand: 0, lastOrderedAt: null },
  { id: "sup_rice", name: { en: "Long Grain Rice", vi: "Gạo Tẻ Hạt Dài" }, packSize: "25kg", packCostVnd: 759000, unit: "bag", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_kidney_beans", name: { en: "Kidney Beans, canned (Bella Napoli)", vi: "Đậu Đỏ Đóng Hộp (Bella Napoli)" }, supplierId: "sup_kamereo", packSize: "400g can", packCostVnd: 33480, unit: "can", par: 24, onHand: 0, lastOrderedAt: null },
  { id: "sup_sugar", name: { en: "Sugar", vi: "Đường" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 28080, unit: "kg", par: 5, onHand: 0, lastOrderedAt: null },
  { id: "sup_brown_sugar", name: { en: "Brown Sugar", vi: "Đường Nâu" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 53460, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_baking_powder", name: { en: "Baking Powder", vi: "Bột Nở" }, supplierId: "sup_kamereo", packSize: "200g", packCostVnd: 28620, unit: "pack", par: 3, onHand: 0, lastOrderedAt: null },
  { id: "sup_breadcrumbs", name: { en: "Breadcrumbs (Panko)", vi: "Bột Chiên Xù (Panko)" }, supplierId: "sup_kamereo", packSize: "1kg", packCostVnd: 53460, unit: "kg", par: 2, onHand: 0, lastOrderedAt: null },

  // ---------- Spices & Seasoning ----------
  { id: "sup_salt", name: { en: "Salt (Sosal iodized)", vi: "Muối I-ốt (Sosal)" }, supplierId: "sup_kamereo", packSize: "500g", packCostVnd: 4000, unit: "pack", par: 6, onHand: 0, lastOrderedAt: null },
  { id: "sup_black_pepper", name: { en: "Black Pepper, ground", vi: "Tiêu Đen Xay" }, supplierId: "sup_kamereo", packSize: "100g", packCostVnd: 48600, unit: "pack", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_allspice", name: { en: "All Spice, ground", vi: "Bột Đa Hương" }, packSize: "500g", packCostVnd: 103500, unit: "pack", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_pimento_whole", name: { en: "Dried Pimento, whole", vi: "Đa Hương Nguyên Hạt Khô" }, packSize: "500g", packCostVnd: 172500, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_cinnamon", name: { en: "Cinnamon, ground", vi: "Bột Quế" }, supplierId: "sup_kamereo", packSize: "35g", packCostVnd: 12420, unit: "pack", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_cloves", name: { en: "Cloves", vi: "Đinh Hương" }, supplierId: "sup_kamereo", packSize: "500g", packCostVnd: 208950, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_nutmeg", name: { en: "Nutmeg", vi: "Nhục Đậu Khấu" }, packSize: "250g", packCostVnd: 69000, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_bay_leaf", name: { en: "Bay Leaf", vi: "Lá Nguyệt Quế" }, packSize: "100g", packCostVnd: 17250, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_curry_powder", name: { en: "Curry Powder — not currently on menu", vi: "Bột Cà Ri — chưa có trên thực đơn" }, packSize: "500g", packCostVnd: 241500, unit: "pack", par: 0, onHand: 0, lastOrderedAt: null },
  { id: "sup_dried_oregano", name: { en: "Dried Oregano", vi: "Oregano Khô" }, supplierId: "sup_kamereo", packSize: "250g", packCostVnd: 96600, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_garlic_powder", name: { en: "Garlic Powder", vi: "Bột Tỏi" }, supplierId: "sup_kamereo", packSize: "600g", packCostVnd: 129060, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_onion_powder", name: { en: "Onion Powder", vi: "Bột Hành" }, packSize: "100g", packCostVnd: 18000, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_all_purpose_seasoning", name: { en: "All Purpose Seasoning (Maggi, closest analog)", vi: "Gia Vị Tổng Hợp (Maggi, gần đúng nhất)" }, supplierId: "sup_kamereo", packSize: "2kg", packCostVnd: 135000, unit: "pack", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_jerk_seasoning_mix", name: { en: "Jerk Seasoning Mix (pre-made)", vi: "Hỗn Hợp Gia Vị Jerk (pha sẵn)" }, packSize: "1kg", packCostVnd: 103500, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },

  // ---------- Sauces, Oils & Condiments ----------
  { id: "sup_vegetable_oil", name: { en: "Vegetable Oil (Simply sunflower)", vi: "Dầu Ăn (Simply hướng dương)" }, supplierId: "sup_kamereo", packSize: "2L", packCostVnd: 141480, unit: "L", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_white_vinegar", name: { en: "White Vinegar", vi: "Giấm Trắng" }, supplierId: "sup_kamereo", packSize: "1L", packCostVnd: 39420, unit: "L", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_ketchup", name: { en: "Tomato Ketchup", vi: "Tương Cà" }, supplierId: "sup_kamereo", packSize: "2.2kg", packCostVnd: 59400, unit: "pack", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_bbq_sauce", name: { en: "BBQ Sauce", vi: "Sốt BBQ" }, supplierId: "sup_kamereo", packSize: "600g", packCostVnd: 66960, unit: "pack", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_dark_soy", name: { en: "Dark Soy Sauce (Lee Kum Kee premium)", vi: "Nước Tương Đen (Lee Kum Kee)" }, supplierId: "sup_kamereo", packSize: "500ml", packCostVnd: 59400, unit: "pack", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_browning_sauce", name: { en: "Browning Sauce", vi: "Nước Màu (Browning Sauce)" }, packSize: "1L", packCostVnd: 69000, unit: "L", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_mayonnaise", name: { en: "Mayonnaise (Kewpie Japanese)", vi: "Sốt Mayonnaise (Kewpie)" }, supplierId: "sup_kamereo", packSize: "300g", packCostVnd: 50760, unit: "pack", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_yellow_mustard", name: { en: "Yellow Mustard", vi: "Mù Tạt Vàng" }, supplierId: "sup_kamereo", packSize: "250g", packCostVnd: 37800, unit: "pack", par: 1, onHand: 0, lastOrderedAt: null },
  { id: "sup_vanilla_extract", name: { en: "Vanilla Extract", vi: "Chiết Xuất Vani" }, packSize: "1L", packCostVnd: 180000, unit: "L", par: 1, onHand: 0, lastOrderedAt: null },

  // ---------- Canned / Jarred ----------
  { id: "sup_canned_peaches", name: { en: "Canned Peaches, halves in syrup — discontinued dish, kept for reference", vi: "Đào Đóng Hộp, nửa quả ngâm si rô — món đã ngừng bán, giữ để tham khảo" }, supplierId: "sup_kamereo", packSize: "825g", packCostVnd: 87480, unit: "can", par: 0, onHand: 0, lastOrderedAt: null },

  // ---------- Drinks & Cocktail Ingredients ----------
  { id: "sup_beer_huda", name: { en: "Beer, Huda (cooking beer, for Jerk Marinade)", vi: "Bia Huda (bia nấu ăn, cho Sốt Ướp Jerk)" }, supplierId: "sup_thai_thinh", packSize: "330ml, 20-can case", packCostVnd: 12250, unit: "can", par: 40, onHand: 0, lastOrderedAt: null },
  { id: "sup_beer_tuborg", name: { en: "Beer, Tuborg Ice (menu)", vi: "Bia Tuborg Ice (thực đơn)" }, supplierId: "sup_thai_thinh", packSize: "330ml, 24-can case", packCostVnd: 15833, unit: "can", par: 48, onHand: 0, lastOrderedAt: null },
  { id: "sup_beer_kblanc", name: { en: "Beer, K Blanc (menu)", vi: "Bia K Blanc (thực đơn)" }, supplierId: "sup_thai_thinh", packSize: "330ml, 24-can case", packCostVnd: 17500, unit: "can", par: 24, onHand: 0, lastOrderedAt: null },
  { id: "sup_orange_juice", name: { en: "Orange Juice (Prima 100%)", vi: "Nước Cam (Prima 100%)" }, supplierId: "sup_kamereo", packSize: "1L", packCostVnd: 45360, unit: "L", par: 6, onHand: 0, lastOrderedAt: null },
  { id: "sup_pineapple_juice", name: { en: "Pineapple Juice (Prima 100%)", vi: "Nước Dứa (Prima 100%)" }, supplierId: "sup_kamereo", packSize: "1L", packCostVnd: 45360, unit: "L", par: 6, onHand: 0, lastOrderedAt: null },
  { id: "sup_passionfruit_syrup", name: { en: "Passionfruit Syrup (Torani)", vi: "Si Rô Chanh Dây (Torani)" }, supplierId: "sup_kamereo", packSize: "750ml", packCostVnd: 195800, unit: "bottle", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_grenadine", name: { en: "Grenadine (Torani)", vi: "Si Rô Lựu (Torani)" }, supplierId: "sup_kamereo", packSize: "750ml", packCostVnd: 195800, unit: "bottle", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_soda_water", name: { en: "Soda Water (Vinh Hao)", vi: "Nước Soda (Vĩnh Hảo)" }, supplierId: "sup_kamereo", packSize: "500ml, 24-bottle case", packCostVnd: 139320, unit: "bottle", par: 24, onHand: 0, lastOrderedAt: null },
  { id: "sup_white_rum", name: { en: "White Rum", vi: "Rượu Rum Trắng" }, supplierId: "sup_liquor_tbd", packSize: "700ml", packCostVnd: 1035000, unit: "bottle", par: 4, onHand: 0, lastOrderedAt: null },
  { id: "sup_dark_rum", name: { en: "Dark Rum", vi: "Rượu Rum Đen" }, supplierId: "sup_liquor_tbd", packSize: "700ml", packCostVnd: 1035000, unit: "bottle", par: 2, onHand: 0, lastOrderedAt: null },
  { id: "sup_spiced_rum", name: { en: "Spiced Rum", vi: "Rượu Rum Gia Vị" }, supplierId: "sup_liquor_tbd", packSize: "700ml", packCostVnd: 1035000, unit: "bottle", par: 2, onHand: 0, lastOrderedAt: null },

  // ---------- Kitchen & Packaging Supplies (not food, not in the book's checklist, but real recurring orders) ----------
  { id: "sup_charcoal", name: { en: "Grill Charcoal", vi: "Than Nướng" }, packSize: "10kg bag", packCostVnd: null, unit: "kg", par: 30, onHand: 0, lastOrderedAt: null },
  { id: "sup_takeaway_boxes", name: { en: "Takeaway Boxes", vi: "Hộp Mang Về" }, packSize: "pack of 50", packCostVnd: null, unit: "box", par: 200, onHand: 0, lastOrderedAt: null },
  { id: "sup_dish_soap", name: { en: "Dish Soap", vi: "Nước Rửa Chén" }, packSize: "5L jug", packCostVnd: null, unit: "jug", par: 4, onHand: 0, lastOrderedAt: null },
];
