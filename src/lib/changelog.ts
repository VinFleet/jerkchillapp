import type { Bi } from "@/lib/types";

export type ChangelogEntry = {
  version: string;
  date: string;
  changes: Bi[];
};

// Newest first. Add a new entry here whenever a meaningful batch of changes
// ships — this is what renders on /changelog so the Owner can see what
// changed without having to ask.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.10",
    date: "2026-08-19",
    changes: [
      {
        en: "Reconciled the app against the real Kitchen Food Safety Book — expanded Reference Rules to match exactly, added Kamereo's real business/cert details and a supplier paperwork checklist, added Staff Training refresher/trainer fields and Health Certificate issue/renewal fields, fixed the Supplier Evaluation \"Docs OK?\" field and a cleaning area label.",
        vi: "Đối chiếu ứng dụng với Sổ Tay An Toàn Thực Phẩm Bếp thật — cập nhật Quy Tắc Tham Khảo khớp chính xác, thêm thông tin kinh doanh/chứng nhận thật của Kamereo và danh mục giấy tờ nhà cung cấp, thêm trường hạn đào tạo lại/người đào tạo và ngày cấp/gia hạn giấy khám sức khỏe, sửa trường \"Hồ sơ đạt?\" trong đánh giá nhà cung cấp và một nhãn khu vực vệ sinh.",
      },
    ],
  },
  {
    version: "1.9",
    date: "2026-08-19",
    changes: [
      {
        en: "Added explicit waste logging to Stock & Production — record spoiled, over-prepped, or dropped food by quantity and reason, with a daily total (VND cost shown to Owner/Manager only).",
        vi: "Thêm tính năng ghi nhận hao hụt trong Tồn Kho & Sản Xuất — ghi lại thực phẩm hư hỏng, làm dư, hoặc rơi vỡ theo số lượng và lý do, kèm tổng số hàng ngày (chi phí VND chỉ hiện với Chủ/Quản lý).",
      },
    ],
  },
  {
    version: "1.8",
    date: "2026-08-19",
    changes: [
      {
        en: "Fixed a bug where every \"previous/next day\" and weekly navigation button (Sales, Bookings, Stock, Usage Variance, Checklists history, Staff rota, Cleaning grid, Sample checks) could skip a day or fail to advance.",
        vi: "Sửa lỗi các nút chuyển ngày/tuần (Doanh thu, Đặt bàn, Tồn kho, Chênh lệch sử dụng, Lịch sử danh sách công việc, Lịch làm nhân viên, Bảng vệ sinh, Kiểm tra mẫu lưu) có thể bị nhảy ngày hoặc không chuyển được.",
      },
      { en: "Added a What's New page (this one) showing version history.", vi: "Thêm trang Có Gì Mới (trang này) hiển thị lịch sử phiên bản." },
    ],
  },
  {
    version: "1.7",
    date: "2026-08-19",
    changes: [
      {
        en: "Fridge & freezer units corrected to the real equipment on site (Drinks Fridge, Under Counter Freezer, Fridge 1 & 2 Kitchen), minimum freezer temp -25°C.",
        vi: "Cập nhật tủ lạnh & tủ đông đúng theo thiết bị thực tế (Tủ Lạnh Đồ Uống, Tủ Đông Dưới Quầy, Tủ Lạnh 1 & 2 Bếp), nhiệt độ tủ đông thấp nhất -25°C.",
      },
    ],
  },
  {
    version: "1.6",
    date: "2026-08-19",
    changes: [
      { en: "Owner login now requires a real password.", vi: "Đăng nhập Chủ nhà hàng nay yêu cầu mật khẩu thật." },
      { en: "Bartender/FOH no longer sees the Recipes module.", vi: "Nhân viên Phục vụ/Bar không còn thấy Sổ Công Thức." },
      { en: "Suppliers now show contact details (phone/email/website) and their rejection/evaluation history.", vi: "Nhà cung cấp hiển thị thông tin liên hệ (điện thoại/email/website) và lịch sử từ chối/đánh giá." },
      { en: "Checklists gained date history (browse past days, read-only) and a print/PDF export.", vi: "Danh sách công việc có lịch sử theo ngày (xem lại các ngày trước, chỉ đọc) và xuất PDF." },
      { en: "Production Planner gained a print/PDF export.", vi: "Kế hoạch sản xuất có tính năng xuất PDF." },
    ],
  },
  {
    version: "1.5",
    date: "2026-08-19",
    changes: [
      { en: "Menu & Pricing matched exactly to the printed menu — real prices, real cocktail list, corrected beer lineup.", vi: "Thực đơn & Giá khớp chính xác với menu in — giá thật, danh sách cocktail thật, sửa lại danh sách bia." },
    ],
  },
  {
    version: "1.4",
    date: "2026-08-19",
    changes: [
      { en: "Real operational data loaded — checklists, food safety log fields, staff roster & policies, contacts, suppliers, and licensing all replaced with real restaurant content.", vi: "Đã nạp dữ liệu vận hành thật — danh sách công việc, các trường sổ an toàn thực phẩm, danh sách & chính sách nhân viên, danh bạ, nhà cung cấp, và giấy phép đều dùng nội dung thật của nhà hàng." },
    ],
  },
  {
    version: "1.3",
    date: "2026-08-19",
    changes: [
      { en: "Table booking system added — staff booking calendar, public online booking page, and ingredient forecasting tied to bookings.", vi: "Thêm hệ thống đặt bàn — lịch đặt bàn cho nhân viên, trang đặt bàn trực tuyến cho khách, và dự báo nguyên liệu theo lượng đặt bàn." },
    ],
  },
  {
    version: "1.2",
    date: "2026-08-19",
    changes: [
      { en: "Phase 2–4 modules added — food safety compliance suite, suppliers, contacts, licensing, sales, staff, menu & pricing, marketing, shopping list, delivery platform tracking, usage variance reporting.", vi: "Thêm các chức năng Giai đoạn 2–4 — bộ an toàn thực phẩm, nhà cung cấp, danh bạ, giấy phép, doanh thu, nhân viên, thực đơn & giá, marketing, danh sách đặt hàng, theo dõi nền tảng giao hàng, báo cáo chênh lệch sử dụng." },
    ],
  },
  {
    version: "1.1",
    date: "2026-08-19",
    changes: [
      { en: "Phase 1 core modules launched — recipe book, stock & production log, checklists, production planner, notice board.", vi: "Ra mắt các chức năng cốt lõi Giai đoạn 1 — sổ công thức, sổ tồn kho & sản xuất, danh sách công việc, kế hoạch sản xuất, bảng thông báo." },
    ],
  },
  {
    version: "1.0",
    date: "2026-08-19",
    changes: [
      { en: "Initial app build — bilingual PWA shell, role-based access, brand theme.", vi: "Xây dựng ứng dụng ban đầu — khung PWA song ngữ, phân quyền theo vai trò, giao diện thương hiệu." },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "1.0";
