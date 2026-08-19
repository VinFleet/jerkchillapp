import type { MenuChannel, RecipeCategory, Bi } from "@/lib/types";

export const MENU_CHANNEL_LABEL: Record<MenuChannel, Bi> = {
  dine_in: { en: "Dine-in", vi: "Tại chỗ" },
  delivery: { en: "Delivery apps", vi: "Ứng dụng giao hàng" },
  lunch_box: { en: "Lunch Rice Box", vi: "Cơm Hộp Trưa" },
};

export const MENU_CHANNEL_ORDER: MenuChannel[] = ["dine_in", "delivery", "lunch_box"];

export type PrintedMaterialField = "item" | "onHand" | "par" | "reorderPoint" | "status" | "toReprint" | "source" | "leadTime";

export const PRINTED_MATERIAL_FIELD_LABEL: Record<PrintedMaterialField, Bi> = {
  item: { en: "Item", vi: "Hạng mục" },
  onHand: { en: "On hand", vi: "Hiện có" },
  par: { en: "Par", vi: "Định mức" },
  reorderPoint: { en: "Reorder at", vi: "Đặt lại khi" },
  status: { en: "Status", vi: "Trạng thái" },
  toReprint: { en: "To reprint", vi: "Cần in lại" },
  source: { en: "Printer / source", vi: "Nhà in / nguồn" },
  leadTime: { en: "Lead time (days)", vi: "Thời gian chờ (ngày)" },
};

export const MENU_CATEGORY_LABEL: Record<RecipeCategory, Bi> = {
  starter: { en: "Starters", vi: "Khai vị" },
  main: { en: "Mains", vi: "Món chính" },
  side: { en: "Sides", vi: "Món phụ" },
  dessert: { en: "Desserts", vi: "Tráng miệng" },
  cocktail: { en: "Cocktails", vi: "Cocktail" },
  roast_sunday: { en: "Roast Sunday", vi: "Roast Sunday" },
  beverage: { en: "Beverages", vi: "Đồ Uống" },
};
