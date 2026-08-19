import type { Notice } from "@/lib/types";

export const SEED_NOTICES: Notice[] = [
  {
    id: "nt_scotch_bonnet",
    title: { en: "Scotch Bonnet running low", vi: "Ớt Scotch Bonnet sắp hết" },
    body: {
      en: "Kamereo delivery short on Scotch Bonnet again this week. Go easy on Hot Escovitch and Spicy Pickles until the next delivery — check with Duc before 86'ing anything.",
      vi: "Kamereo giao thiếu ớt Scotch Bonnet lần nữa trong tuần này. Hạn chế dùng cho Sốt Escovitch Cay và Dưa Chua Cay đến khi có hàng mới — hỏi Duc trước khi ngừng bán món nào.",
    },
    postedBy: "Manny",
    role: "owner",
    priority: "urgent",
    createdAt: "2026-08-17T09:15:00.000Z",
  },
  {
    id: "nt_price_list",
    title: { en: "New Kamereo price list uploaded", vi: "Đã cập nhật bảng giá Kamereo mới" },
    body: {
      en: "This week's Kamereo price list is in. A couple of produce items moved — worth a look before the next order.",
      vi: "Bảng giá Kamereo tuần này đã có. Một vài mặt hàng rau củ có thay đổi giá — nên xem trước khi đặt hàng tiếp theo.",
    },
    postedBy: "Manny",
    role: "owner",
    priority: "normal",
    createdAt: "2026-08-16T14:00:00.000Z",
  },
  {
    id: "nt_table4",
    title: { en: "Table 4 — repeat guest, nut allergy", vi: "Bàn 4 — khách quen, dị ứng hạt" },
    body: {
      en: "Regular guest booked for Saturday 7pm has a tree nut allergy. Please double check the Apple Crumble prep area is clean before her order.",
      vi: "Khách quen đặt bàn thứ Bảy 19h bị dị ứng hạt cây. Vui lòng kiểm tra kỹ khu chuẩn bị Bánh Táo Nướng Giòn sạch sẽ trước khi làm món cho khách.",
    },
    postedBy: "Manny",
    role: "manager",
    priority: "urgent",
    createdAt: "2026-08-18T11:30:00.000Z",
  },
];
