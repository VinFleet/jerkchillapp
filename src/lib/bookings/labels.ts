import type { BookingStatus, TableShape } from "@/lib/bookings/types";

export const STATUS_LABEL: Record<BookingStatus, { en: string; vi: string }> = {
  confirmed: { en: "Confirmed", vi: "Đã xác nhận" },
  seated: { en: "Seated", vi: "Đã vào bàn" },
  completed: { en: "Completed", vi: "Hoàn tất" },
  cancelled: { en: "Cancelled", vi: "Đã hủy" },
  no_show: { en: "No-show", vi: "Không đến" },
};

export const STATUS_TONE: Record<BookingStatus, "success" | "warning" | "danger" | "muted" | "brand"> = {
  confirmed: "brand",
  seated: "success",
  completed: "muted",
  cancelled: "danger",
  no_show: "danger",
};

export const STATUS_ORDER: BookingStatus[] = ["confirmed", "seated", "completed", "no_show", "cancelled"];

export const SHAPE_LABEL: Record<TableShape, { en: string; vi: string }> = {
  square: { en: "Square", vi: "Vuông" },
  round: { en: "Round", vi: "Tròn" },
  rect: { en: "Long", vi: "Dài" },
};
