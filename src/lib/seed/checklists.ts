import type { ChecklistItem } from "@/lib/types";

// Real checklist text from the Daily Operations Book (OPERATIONS_AND_FOOD_SAFETY_DATA.md Part A).
// Kitchen Opening #1 and Kitchen Closing #5 deep-link into their Food Safety
// logs rather than being standalone checkboxes — ticking them takes you
// straight to the real log, per the spec.

export const SEED_CHECKLIST_ITEMS: ChecklistItem[] = [
  // Kitchen — Opening
  { id: "cl_k_o_1", area: "kitchen", shift: "opening", order: 1, active: true, text: { en: "Fridge & freezer temps checked and logged", vi: "Kiểm tra và ghi nhiệt độ tủ lạnh, tủ đông" }, linkHref: "/food-safety/temperature" },
  { id: "cl_k_o_2", area: "kitchen", shift: "opening", order: 2, active: true, text: { en: "No pest signs", vi: "Không có dấu hiệu côn trùng, gây hại" } },
  { id: "cl_k_o_3", area: "kitchen", shift: "opening", order: 3, active: true, text: { en: "Site clean, surfaces sanitised", vi: "Khu vực sạch, bề mặt đã khử trùng" } },
  { id: "cl_k_o_4", area: "kitchen", shift: "opening", order: 4, active: true, text: { en: "Handwash stations stocked", vi: "Đủ xà phòng và khăn rửa tay" } },
  { id: "cl_k_o_5", area: "kitchen", shift: "opening", order: 5, active: true, text: { en: "Prep list reviewed against Recipe Book batch quantities", vi: "Đối chiếu danh sách chuẩn bị với Sổ Công Thức" } },
  { id: "cl_k_o_6", area: "kitchen", shift: "opening", order: 6, active: true, text: { en: "Marinated stock from Prep Chef checked in and logged", vi: "Kiểm tra và ghi nhận nguyên liệu ướp từ Bếp Sơ Chế" } },
  { id: "cl_k_o_7", area: "kitchen", shift: "opening", order: 7, active: true, text: { en: "Grill, fryer, rice cooker on and up to temperature", vi: "Bật vỉ nướng, chảo chiên, nồi cơm, đạt nhiệt độ" } },

  // Kitchen — Closing
  { id: "cl_k_c_1", area: "kitchen", shift: "closing", order: 1, active: true, text: { en: "Food stored correctly", vi: "Thực phẩm được bảo quản đúng cách" } },
  { id: "cl_k_c_2", area: "kitchen", shift: "closing", order: 2, active: true, text: { en: "Surfaces cleaned and disinfected", vi: "Bề mặt đã vệ sinh và khử trùng" } },
  { id: "cl_k_c_3", area: "kitchen", shift: "closing", order: 3, active: true, text: { en: "Waste removed", vi: "Rác đã được dọn sạch" } },
  { id: "cl_k_c_4", area: "kitchen", shift: "closing", order: 4, active: true, text: { en: "Equipment off", vi: "Thiết bị đã tắt" } },
  { id: "cl_k_c_5", area: "kitchen", shift: "closing", order: 5, active: true, text: { en: "Three-Step Inspection & Sample Retention logs completed", vi: "Hoàn thành Sổ Kiểm Thực Ba Bước & Lưu Mẫu" }, linkHref: "/food-safety/inspections" },
  { id: "cl_k_c_6", area: "kitchen", shift: "closing", order: 6, active: true, text: { en: "Kitchen signed off closed", vi: "Bếp đã được xác nhận đóng cửa" } },

  // FOH — Opening
  { id: "cl_f_o_1", area: "foh", shift: "opening", order: 1, active: true, text: { en: "Unlock, disarm alarm, lights & music on", vi: "Mở cửa, tắt báo động, bật đèn & nhạc" } },
  { id: "cl_f_o_2", area: "foh", shift: "opening", order: 2, active: true, text: { en: "POS system on and tested", vi: "Bật và kiểm tra máy POS" } },
  { id: "cl_f_o_3", area: "foh", shift: "opening", order: 3, active: true, text: { en: "Tables, chairs, and floor clean", vi: "Bàn ghế, sàn nhà sạch sẽ" } },
  { id: "cl_f_o_4", area: "foh", shift: "opening", order: 4, active: true, text: { en: "Menus present and undamaged", vi: "Thực đơn đầy đủ, không hư hỏng" } },
  { id: "cl_f_o_5", area: "foh", shift: "opening", order: 5, active: true, text: { en: "Bar stocked: beer, soft drinks, water, spirits", vi: "Quầy bar đủ hàng: bia, nước ngọt, nước lọc, rượu" } },
  { id: "cl_f_o_6", area: "foh", shift: "opening", order: 6, active: true, text: { en: "Cash float counted and logged", vi: "Đếm và ghi lại tiền quỹ đầu ca" } },
  { id: "cl_f_o_7", area: "foh", shift: "opening", order: 7, active: true, text: { en: "GrabFood / ShopeeFood tablets online", vi: "Máy tính bảng Grab/Shopee hoạt động" } },

  // FOH — Closing
  { id: "cl_f_c_1", area: "foh", shift: "closing", order: 1, active: true, text: { en: "Cash reconciled against POS Z-report", vi: "Đối chiếu tiền mặt với báo cáo POS" } },
  { id: "cl_f_c_2", area: "foh", shift: "closing", order: 2, active: true, text: { en: "Float removed and safe-stored", vi: "Cất tiền quỹ vào két an toàn" } },
  { id: "cl_f_c_3", area: "foh", shift: "closing", order: 3, active: true, text: { en: "Tables, chairs, bar wiped down", vi: "Lau bàn ghế, quầy bar" } },
  { id: "cl_f_c_4", area: "foh", shift: "closing", order: 4, active: true, text: { en: "Bins emptied, taken outside", vi: "Đổ rác, mang ra ngoài" } },
  { id: "cl_f_c_5", area: "foh", shift: "closing", order: 5, active: true, text: { en: "Delivery tablets logged off", vi: "Đăng xuất máy tính bảng giao hàng" } },
  { id: "cl_f_c_6", area: "foh", shift: "closing", order: 6, active: true, text: { en: "Lights off (except security), doors locked, alarm set", vi: "Tắt đèn, khóa cửa, bật báo động" } },
];
