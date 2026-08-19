import type { WasteReason, Bi } from "@/lib/types";

export const WASTE_REASON_LABEL: Record<WasteReason, Bi> = {
  over_prepped: { en: "Over-prepped, not sold", vi: "Làm dư, không bán hết" },
  spoiled: { en: "Spoiled / expired", vi: "Hư hỏng / hết hạn" },
  prep_error: { en: "Dropped / prep error", vi: "Rơi vỡ / lỗi chế biến" },
  other: { en: "Other", vi: "Khác" },
};

export const WASTE_REASON_ORDER: WasteReason[] = ["over_prepped", "spoiled", "prep_error", "other"];
