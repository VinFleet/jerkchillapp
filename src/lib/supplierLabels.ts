import type { SupplierCategory, SupplierStatus, Bi } from "@/lib/types";

export const SUPPLIER_CATEGORY_LABEL: Record<SupplierCategory, Bi> = {
  grocery: { en: "Grocery & dry goods", vi: "Tạp hóa & hàng khô" },
  beer: { en: "Beer", vi: "Bia" },
  liquor: { en: "Liquor", vi: "Rượu mạnh" },
  produce_market: { en: "Local market", vi: "Chợ địa phương" },
  ice: { en: "Ice", vi: "Nước đá" },
  other: { en: "Other", vi: "Khác" },
};

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, Bi> = {
  approved: { en: "Approved", vi: "Đã duyệt" },
  review: { en: "Under review", vi: "Đang xem xét" },
  replace: { en: "Replace", vi: "Cần thay thế" },
};

export const SUPPLIER_STATUS_TONE: Record<SupplierStatus, "success" | "warning" | "danger"> = {
  approved: "success",
  review: "warning",
  replace: "danger",
};
