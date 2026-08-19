import type { Contact } from "@/lib/types";

// Vietnam's national emergency numbers are public information and safe to
// pre-fill. Real contacts from OPERATIONS_AND_FOOD_SAFETY_DATA.md Part D are
// seeded where known; anything marked "not yet logged" stays a visible empty
// state for the owner/manager to fill in, not an invented number.

export const SEED_CONTACTS: Contact[] = [
  { id: "ct_police", category: "emergency", name: "Police · Công an", phone: "113" },
  { id: "ct_fire", category: "emergency", name: "Fire · Cứu hỏa", phone: "114" },
  { id: "ct_medical", category: "emergency", name: "Medical emergency · Cấp cứu y tế", phone: "115" },
  { id: "ct_kamereo", category: "supplier", name: "Kamereo", linkedSupplierId: "sup_kamereo", notes: "Grocery, dry goods, produce, dairy, spices — weekly price list" },
  { id: "ct_thai_thinh", category: "supplier", name: "Công ty TNHH MTV Thái Thịnh", linkedSupplierId: "sup_thai_thinh", notes: "Beer: Huda, Tuborg Ice, K Blanc" },
  { id: "ct_goi_da", category: "supplier", name: "Gọi Đá", phone: "0865 609 135", linkedSupplierId: "sup_goi_da", notes: "Ice" },
  { id: "ct_building", category: "building", name: "Thien Minh Building Management", phone: "0909 689 398" },
  { id: "ct_authority", category: "other", name: "Local Food Safety Authority · Cơ quan An Toàn Thực Phẩm địa phương", notes: "Not yet logged — add contact · Chưa có thông tin — thêm liên hệ" },
  { id: "ct_pest", category: "other", name: "Pest control provider · Đơn vị kiểm soát côn trùng", notes: "Not yet logged — add contact · Chưa có thông tin — thêm liên hệ" },
];
