import type { RecipeCategory, Bi } from "@/lib/types";

export const CATEGORY_LABEL: Record<RecipeCategory, Bi> = {
  starter: { en: "Starter", vi: "Khai vị" },
  main: { en: "Mains", vi: "Món chính" },
  side: { en: "Sides", vi: "Món phụ" },
  dessert: { en: "Dessert", vi: "Tráng miệng" },
  cocktail: { en: "Cocktails", vi: "Cocktail" },
  roast_sunday: { en: "Roast Sunday", vi: "Roast Sunday" },
  beverage: { en: "Beverages", vi: "Đồ Uống" },
};

export const CATEGORY_ORDER: RecipeCategory[] = [
  "main",
  "side",
  "dessert",
  "roast_sunday",
  "cocktail",
  "beverage",
  "starter",
];
