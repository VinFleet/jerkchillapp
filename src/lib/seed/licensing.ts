import type { License } from "@/lib/types";

// The licences/certs called out in OPERATIONS_AND_FOOD_SAFETY_DATA.md Part G,
// seeded with real legal citations but no date — real compliance expiry
// dates are never guessed. Owner/Manager fills each one in once from the
// real certificate; reminders switch on automatically once set. Items the
// source marks "confirm with Owner" carry that as a visible note, not a
// silently-assumed renewal cycle.

export const SEED_LICENSES: License[] = [
  { id: "lic_food_safety", name: { en: "Certificate of Eligibility for Food Safety", vi: "Giấy Chứng Nhận Đủ Điều Kiện An Toàn Thực Phẩm" }, expiryDate: null, renewalLeadDays: 60, notes: { en: "3-year renewal (Điều 37, Luật ATTP 2010)", vi: "Gia hạn 3 năm (Điều 37, Luật ATTP 2010)" } },
  { id: "lic_business_reg", name: { en: "Business Registration Certificate", vi: "Giấy Chứng Nhận Đăng Ký Kinh Doanh" }, expiryDate: null, renewalLeadDays: 30, notes: { en: "On file — no recurring renewal", vi: "Đã có hồ sơ — không cần gia hạn định kỳ" } },
  { id: "lic_staff_training", name: { en: "Staff Food-Safety Training", vi: "Đào Tạo An Toàn Thực Phẩm Cho Nhân Viên" }, expiryDate: null, renewalLeadDays: 30, notes: { en: "In-house, owner-certified — no government exam since Nghị định 155/2018/NĐ-CP", vi: "Tự đào tạo nội bộ, chủ xác nhận — không cần thi sát hạch nhà nước theo Nghị định 155/2018/NĐ-CP" } },
  { id: "lic_pccc", name: { en: "PCCC Fire Safety Certificate", vi: "Giấy Chứng Nhận PCCC" }, expiryDate: null, renewalLeadDays: 60, notes: { en: "Confirm status and renewal cycle with Owner", vi: "Cần xác nhận tình trạng và chu kỳ gia hạn với Chủ" } },
  { id: "lic_water", name: { en: "Annual Water Quality Test", vi: "Kiểm Nghiệm Chất Lượng Nước Hàng Năm" }, expiryDate: null, renewalLeadDays: 30, notes: { en: "Annual, only if using well/tank water", vi: "Hàng năm, chỉ áp dụng nếu dùng nước giếng/bồn chứa" } },
  { id: "lic_pest", name: { en: "Pest Control Contract", vi: "Hợp Đồng Kiểm Soát Côn Trùng" }, expiryDate: null, renewalLeadDays: 30, notes: { en: "Confirm renewal cycle with Owner", vi: "Cần xác nhận chu kỳ gia hạn với Chủ" } },
];
