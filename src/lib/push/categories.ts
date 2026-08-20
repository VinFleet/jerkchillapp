import type { Bi } from "@/lib/types";

/**
 * What a person can be told about.
 *
 * Deliberately per-person rather than per-role. A kitchen assistant who also
 * does the ordering wants the shopping alerts; a bartender covering a shift
 * does not. Guessing from someone's job title produces alerts they ignore, and
 * an alert people ignore is worse than no alert — it teaches them to swipe the
 * next one away too.
 */
export const PUSH_CATEGORIES = [
  "shopping",
  "bookings",
  "issues",
  "food_safety",
  "checklists",
  "notices",
] as const;

export type PushCategory = (typeof PUSH_CATEGORIES)[number];

export const PUSH_CATEGORY_LABEL: Record<PushCategory, Bi> = {
  shopping: { en: "Shopping & orders", vi: "Mua hàng & đặt hàng" },
  bookings: { en: "Table & booking changes", vi: "Thay đổi bàn & đặt bàn" },
  issues: { en: "Problems & complaints", vi: "Sự cố & khiếu nại" },
  food_safety: { en: "Food safety alerts", vi: "Cảnh báo an toàn thực phẩm" },
  checklists: { en: "Checklist reminders", vi: "Nhắc việc danh sách" },
  notices: { en: "Urgent notices", vi: "Thông báo khẩn" },
};

export const PUSH_CATEGORY_HINT: Record<PushCategory, Bi> = {
  shopping: {
    en: "An order is ready to send, or something has dropped below par",
    vi: "Đơn hàng sẵn sàng gửi, hoặc hàng dưới định mức",
  },
  bookings: {
    en: "A guest books, cancels, or changes table",
    vi: "Khách đặt, hủy hoặc đổi bàn",
  },
  issues: {
    en: "A complaint, a rejected delivery, or equipment trouble",
    vi: "Khiếu nại, hàng bị từ chối, hoặc hỏng thiết bị",
  },
  food_safety: {
    en: "A temperature out of range, or a check that's overdue",
    vi: "Nhiệt độ ngoài ngưỡng, hoặc kiểm tra quá hạn",
  },
  checklists: {
    en: "Opening or closing checklist still unfinished",
    vi: "Danh sách mở/đóng cửa chưa xong",
  },
  notices: {
    en: "Anything the manager marks urgent",
    vi: "Nội dung quản lý đánh dấu khẩn",
  },
};

/**
 * What someone gets before they've chosen anything.
 *
 * Urgent notices and food safety only — the two where missing one has a
 * consequence beyond inconvenience. Everything else is opt-in, so the first
 * alerts a new starter receives are ones that actually warrant interrupting
 * them.
 */
export const DEFAULT_PUSH_CATEGORIES: PushCategory[] = ["notices", "food_safety"];

export function isPushCategory(value: string): value is PushCategory {
  return (PUSH_CATEGORIES as readonly string[]).includes(value);
}
