import type { SupplyItem } from "@/lib/types";

// Structural starter list only — par levels are reasonable working defaults
// (like the Phase 1 bar par levels), but pack costs are never guessed:
// packCostVnd stays null ("unconfirmed") until a real invoice price is
// entered, exactly like Menu & Pricing and Licensing dates elsewhere in
// this app.

export const SEED_SUPPLY_ITEMS: SupplyItem[] = [
  { id: "sup_chicken_legs", name: { en: "Chicken leg quarters", vi: "Đùi gà nguyên" }, supplierId: "sup_kamereo", packSize: "4pc pack, fresh (CP Chicken)", packCostVnd: 90000, unit: "kg", par: 40, onHand: 0, lastOrderedAt: null },
  { id: "sup_rice", name: { en: "Long grain rice", vi: "Gạo tẻ hạt dài" }, supplierId: "sup_kamereo", packSize: "25kg bag", packCostVnd: null, unit: "kg", par: 50, onHand: 0, lastOrderedAt: null },
  { id: "sup_kidney_beans", name: { en: "Kidney beans, canned", vi: "Đậu đỏ đóng hộp" }, supplierId: "sup_kamereo", packSize: "case of 24", packCostVnd: null, unit: "can", par: 96, onHand: 0, lastOrderedAt: null },
  { id: "sup_coconut_milk", name: { en: "Coconut milk", vi: "Nước cốt dừa" }, supplierId: "sup_kamereo", packSize: "case of 24", packCostVnd: null, unit: "can", par: 48, onHand: 0, lastOrderedAt: null },
  { id: "sup_charcoal", name: { en: "Grill charcoal", vi: "Than nướng" }, packSize: "10kg bag", packCostVnd: null, unit: "kg", par: 30, onHand: 0, lastOrderedAt: null },
  { id: "sup_takeaway_boxes", name: { en: "Takeaway boxes", vi: "Hộp mang về" }, packSize: "pack of 50", packCostVnd: null, unit: "box", par: 200, onHand: 0, lastOrderedAt: null },
  { id: "sup_dish_soap", name: { en: "Dish soap", vi: "Nước rửa chén" }, packSize: "5L jug", packCostVnd: null, unit: "jug", par: 4, onHand: 0, lastOrderedAt: null },
];
