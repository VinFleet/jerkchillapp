import type { ContactCategory, Bi } from "@/lib/types";

export const CONTACT_CATEGORY_LABEL: Record<ContactCategory, Bi> = {
  supplier: { en: "Suppliers", vi: "Nhà cung cấp" },
  staff: { en: "Staff", vi: "Nhân viên" },
  emergency: { en: "Emergency services", vi: "Dịch vụ khẩn cấp" },
  building: { en: "Building management", vi: "Quản lý tòa nhà" },
  other: { en: "Other", vi: "Khác" },
};

export const CONTACT_CATEGORY_ORDER: ContactCategory[] = ["emergency", "supplier", "staff", "building", "other"];
