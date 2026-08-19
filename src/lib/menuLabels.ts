import type { MenuChannel, RecipeCategory, Bi } from "@/lib/types";

export const MENU_CHANNEL_LABEL: Record<MenuChannel, Bi> = {
  dine_in: { en: "Dine-in", vi: "Tại chỗ" },
  delivery: { en: "Delivery apps", vi: "Ứng dụng giao hàng" },
  lunch_box: { en: "Lunch Rice Box", vi: "Cơm Hộp Trưa" },
};

export const MENU_CHANNEL_ORDER: MenuChannel[] = ["dine_in", "delivery", "lunch_box"];

export const MENU_CATEGORY_LABEL: Record<RecipeCategory, Bi> = {
  starter: { en: "Starters", vi: "Khai vị" },
  main: { en: "Mains", vi: "Món chính" },
  side: { en: "Sides", vi: "Món phụ" },
  dessert: { en: "Desserts", vi: "Tráng miệng" },
  cocktail: { en: "Cocktails", vi: "Cocktail" },
  roast_sunday: { en: "Roast Sunday", vi: "Roast Sunday" },
  beverage: { en: "Beverages", vi: "Đồ Uống" },
};
