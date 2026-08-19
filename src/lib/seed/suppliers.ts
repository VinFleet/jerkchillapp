import type { Supplier, SupplierDocItem } from "@/lib/types";

// Real suppliers from OPERATIONS_AND_FOOD_SAFETY_DATA.md Part F. Kamereo,
// Thái Thịnh, and Gọi Đá are real, currently-used suppliers. The liquor
// supplier isn't named yet, so it's seeded as a clearly-labeled placeholder —
// per the spec a restaurant like this never has just one supplier (separate
// beer, liquor, market and ice suppliers) — so the structure is ready, but no
// fabricated business name or certs are entered for the one not set up yet.

// Kamereo's real details, from the Kitchen Food Safety Book Section 3.3.
export const KAMEREO_DOC_CHECKLIST: SupplierDocItem[] = [
  { label: { en: "Copy of business registration certificate on file (No. 0315000500)", vi: "Bản sao giấy ĐKKD lưu hồ sơ (Số 0315000500)" }, checked: false },
  { label: { en: "Food safety / HACCP certificate for their warehouse (Tay Thanh Distribution Center, HCMC)", vi: "Giấy chứng nhận ATTP/HACCP của kho hàng (Trung tâm phân phối Tây Thạnh, TP.HCM)" }, checked: false },
  { label: { en: "Wholesale liquor licence copy (227/GP-SCT) — only if ordering alcohol through them", vi: "Bản sao giấy phép bán buôn rượu (227/GP-SCT) — chỉ khi đặt rượu qua Kamereo" }, checked: false },
  { label: { en: "VAT invoice for every order — issued automatically in the app on delivery day; save/file each one", vi: "Hóa đơn VAT cho mỗi đơn — ứng dụng tự xuất vào ngày giao; lưu từng hóa đơn" }, checked: false },
  { label: { en: "Delivery slip for every order — provided automatically with each delivery; file with the invoice", vi: "Phiếu giao hàng cho mỗi đơn — tự động kèm mỗi lần giao; lưu cùng hóa đơn" }, checked: false },
  { label: { en: "Order & origin history — exportable from the app; save monthly for traceability", vi: "Lịch sử đơn hàng & nguồn gốc — xuất từ ứng dụng; lưu hàng tháng để truy xuất" }, checked: false },
  { label: { en: "Quarantine/veterinary certificate — request for each meat, poultry, or seafood order", vi: "Giấy kiểm dịch/thú y — yêu cầu cho mỗi đơn thịt, gia cầm, hải sản" }, checked: false },
  { label: { en: "VietGAP/GlobalGAP/organic certificate — request when produce is sold as certified", vi: "Chứng nhận VietGAP/GlobalGAP/hữu cơ — yêu cầu khi rau củ được bán là đạt chuẩn" }, checked: false },
  { label: { en: "Product declaration/self-declaration — request for packaged or processed goods", vi: "Bản công bố sản phẩm — yêu cầu cho hàng đóng gói hoặc chế biến sẵn" }, checked: false },
];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "sup_kamereo",
    name: "Kamereo",
    category: "grocery",
    contactId: "ct_kamereo",
    businessRegNo: "0315000500 — issued 19 Apr 2018, Dept. of Planning & Investment, HCMC",
    regOnFile: true,
    otherCerts: "Wholesale liquor licence 227/GP-SCT — issued 15 Jun 2023, Dept. of Industry & Trade, HCMC (if ordering alcohol)",
    documentChecklist: KAMEREO_DOC_CHECKLIST,
    status: "approved",
  },
  {
    id: "sup_thai_thinh",
    name: "Công ty TNHH MTV Thái Thịnh",
    category: "beer",
    contactId: "ct_thai_thinh",
    status: "approved",
  },
  {
    id: "sup_liquor_tbd",
    name: "Liquor supplier — add details",
    category: "liquor",
    status: "review",
  },
  {
    id: "sup_market_tbd",
    name: "Local market — Thảo Điền",
    category: "produce_market",
    status: "review",
  },
  {
    id: "sup_goi_da",
    name: "Gọi Đá",
    category: "ice",
    contactId: "ct_goi_da",
    status: "approved",
  },
];
