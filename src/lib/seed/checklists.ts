import type { ChecklistItem } from "@/lib/types";

// Real checklist text transcribed from the Chef's Recipe Book's Chef/FOH
// Opening & Closing Checklists (English-only in the source — Vietnamese
// translations below are ours, matching the app's house style). Several
// items deep-link into the matching module instead of being a standalone
// checkbox, per the app's established pattern. The book's own Chef Opening
// item #1 references a separate "Daily Portion Check" printed sheet (not
// part of the book) — represented here as a link into the Production
// Planner, the closest in-app equivalent of "what needs producing today."

export const SEED_CHECKLIST_ITEMS: ChecklistItem[] = [
  // Kitchen (Chef) — Opening
  { id: "cl_k_o_1", area: "kitchen", shift: "opening", order: 1, active: true, text: { en: "Daily Portion Check done first — every item counted against today's minimum (25 Mon–Wed, 50 Thu–Sun) before anything else starts", vi: "Kiểm Tra Khẩu Phần Hàng Ngày làm trước tiên — đếm mọi món theo mức tối thiểu hôm nay (25 Thứ 2–4, 50 Thứ 5–CN) trước khi làm gì khác" }, linkHref: "/planner" },
  { id: "cl_k_o_2", area: "kitchen", shift: "opening", order: 2, active: true, text: { en: "Rice is hot", vi: "Cơm đã nóng" } },
  { id: "cl_k_o_3", area: "kitchen", shift: "opening", order: 3, active: true, text: { en: "Steamed veg is warm", vi: "Rau củ hấp đã ấm" } },
  { id: "cl_k_o_4", area: "kitchen", shift: "opening", order: 4, active: true, text: { en: "Dumplings are good — cut and taste test with the chefs", vi: "Bánh bột chiên đạt — cắt và nếm thử cùng các bếp" } },
  { id: "cl_k_o_5", area: "kitchen", shift: "opening", order: 5, active: true, text: { en: "Dumplings made fresh every day — no held-over batches", vi: "Bánh bột chiên làm mới mỗi ngày — không dùng mẻ để qua đêm" } },
  { id: "cl_k_o_6", area: "kitchen", shift: "opening", order: 6, active: true, text: { en: "Coleslaw is ready", vi: "Coleslaw đã sẵn sàng" } },
  { id: "cl_k_o_7", area: "kitchen", shift: "opening", order: 7, active: true, text: { en: "Minimum 40 portions each of House Salad and Coleslaw prepped", vi: "Chuẩn bị tối thiểu 40 khẩu phần mỗi loại Salad Nhà Làm và Coleslaw" } },
  { id: "cl_k_o_8", area: "kitchen", shift: "opening", order: 8, active: true, text: { en: "Mac and Cheese portions ready (current recipe), portioned into small containers, and out of the fridge to reach room temperature", vi: "Mì Ống Phô Mai đã chia phần (theo công thức hiện tại) vào hộp nhỏ, để ngoài tủ lạnh cho về nhiệt độ phòng" } },
  { id: "cl_k_o_9", area: "kitchen", shift: "opening", order: 9, active: true, text: { en: "Raw chicken is out of the fridge, resting to room temp — cooks more evenly", vi: "Gà sống đã để ngoài tủ lạnh, về nhiệt độ phòng — nướng chín đều hơn" } },
  { id: "cl_k_o_10", area: "kitchen", shift: "opening", order: 10, active: true, text: { en: "Sauce is ready", vi: "Sốt đã sẵn sàng" } },
  { id: "cl_k_o_11", area: "kitchen", shift: "opening", order: 11, active: true, text: { en: "Plantain is good", vi: "Chuối chiên đạt" } },
  { id: "cl_k_o_12", area: "kitchen", shift: "opening", order: 12, active: true, text: { en: "Record Opening Stock on the Daily Stock & Production Log (yesterday's leftovers) — use it to decide what needs producing today", vi: "Ghi Tồn Kho Đầu Ngày vào Sổ Tồn Kho & Sản Xuất (hàng còn lại hôm qua) — dùng để quyết định cần sản xuất gì hôm nay" }, linkHref: "/stock" },
  { id: "cl_k_o_13", area: "kitchen", shift: "opening", order: 13, active: true, text: { en: "Check fridge and freezer temperatures, log them", vi: "Kiểm tra nhiệt độ tủ lạnh, tủ đông và ghi lại" }, linkHref: "/food-safety/temperature" },
  { id: "cl_k_o_14", area: "kitchen", shift: "opening", order: 14, active: true, text: { en: "Fryer, grill and oven switched on and up to temperature before service", vi: "Bật chảo chiên, vỉ nướng, lò nướng và đạt nhiệt độ trước giờ phục vụ" } },
  { id: "cl_k_o_15", area: "kitchen", shift: "opening", order: 15, active: true, text: { en: "Pass/plating station clean, stocked with plates, garnish, sauces", vi: "Khu vực lên món sạch sẽ, đủ đĩa, nguyên liệu trang trí, nước sốt" } },
  { id: "cl_k_o_16", area: "kitchen", shift: "opening", order: 16, active: true, text: { en: "Kitchen garnish station stocked — fresh thyme, spring onions", vi: "Khu nguyên liệu trang trí bếp đủ hàng — thyme tươi, hành lá" } },
  { id: "cl_k_o_17", area: "kitchen", shift: "opening", order: 17, active: true, text: { en: "Check today's stock of Scotch Bonnet, fresh herbs, and other short-shelf-life produce — flag anything close to unusable", vi: "Kiểm tra tồn kho hôm nay của ớt Scotch Bonnet, rau thơm tươi, và nguyên liệu mau hỏng khác — báo ngay nếu sắp hỏng" } },
  { id: "cl_k_o_18", area: "kitchen", shift: "opening", order: 18, active: true, text: { en: "Confirm today's specials (Roast Sunday, if applicable) and any 86'd items with the team before doors open", vi: "Xác nhận món đặc biệt hôm nay (Roast Sunday, nếu có) và các món hết hàng với cả đội trước khi mở cửa" } },
  { id: "cl_k_o_19", area: "kitchen", shift: "opening", order: 19, active: true, text: { en: "Cleaning supplies and hand soap stocked at every station", vi: "Đủ dụng cụ vệ sinh và xà phòng rửa tay tại mọi trạm" } },
  { id: "cl_k_o_20", area: "kitchen", shift: "opening", order: 20, active: true, text: { en: "Bins emptied and lined, ready for the day", vi: "Thùng rác đã đổ và lót túi, sẵn sàng cho ngày mới" } },
  { id: "cl_k_o_21", area: "kitchen", shift: "opening", order: 21, active: true, text: { en: "Bar stocked and premix jars checked (once cocktails are live)", vi: "Quầy bar đủ hàng và kiểm tra bình premix (khi cocktail đã bán)" } },
  { id: "cl_k_o_22", area: "kitchen", shift: "opening", order: 22, active: true, text: { en: "Bar garnish station stocked — mint, sliced orange, sliced lime, thyme, pineapple/pineapple leaves", vi: "Khu nguyên liệu trang trí bar đủ hàng — bạc hà, cam lát, chanh lát, thyme, dứa/lá dứa" } },
  { id: "cl_k_o_23", area: "kitchen", shift: "opening", order: 23, active: true, text: { en: "Front of house — tables, menus, condiments, cutlery all set", vi: "Khu vực phục vụ — bàn, thực đơn, gia vị, dao nĩa đã chuẩn bị đủ" } },

  // Kitchen (Chef) — Closing
  { id: "cl_k_c_1", area: "kitchen", shift: "closing", order: 1, active: true, text: { en: "Record Closing Stock on the Daily Stock & Production Log for every item — this becomes tomorrow's Opening Stock", vi: "Ghi Tồn Kho Cuối Ngày vào Sổ Tồn Kho & Sản Xuất cho mọi món — đây sẽ là Tồn Kho Đầu Ngày mai" }, linkHref: "/stock" },
  { id: "cl_k_c_2", area: "kitchen", shift: "closing", order: 2, active: true, text: { en: "Note any waste on the log so it's not repeated in tomorrow's production", vi: "Ghi lại hao hụt để không lặp lại khi sản xuất ngày mai" }, linkHref: "/stock" },
  { id: "cl_k_c_3", area: "kitchen", shift: "closing", order: 3, active: true, text: { en: "Turn off fryer, grill and oven safely once all prep/service is done", vi: "Tắt an toàn chảo chiên, vỉ nướng, lò nướng khi đã xong chuẩn bị/phục vụ" } },
  { id: "cl_k_c_4", area: "kitchen", shift: "closing", order: 4, active: true, text: { en: "Clean and sanitize every station and all surfaces", vi: "Vệ sinh và khử trùng mọi trạm và bề mặt" } },
  { id: "cl_k_c_5", area: "kitchen", shift: "closing", order: 5, active: true, text: { en: "Check and log fridge/freezer temperatures again before leaving", vi: "Kiểm tra và ghi lại nhiệt độ tủ lạnh/tủ đông lần nữa trước khi ra về" }, linkHref: "/food-safety/temperature" },
  { id: "cl_k_c_6", area: "kitchen", shift: "closing", order: 6, active: true, text: { en: "Wrap and label anything held overnight, with date", vi: "Bọc và dán nhãn ngày tháng cho mọi thứ để qua đêm" } },
  { id: "cl_k_c_7", area: "kitchen", shift: "closing", order: 7, active: true, text: { en: "Empty and take out all bins", vi: "Đổ và mang hết rác ra ngoài" } },
  { id: "cl_k_c_8", area: "kitchen", shift: "closing", order: 8, active: true, text: { en: "Stock rooms and walk-in locked and secured", vi: "Kho hàng và kho lạnh đã khóa và an toàn" } },
  { id: "cl_k_c_9", area: "kitchen", shift: "closing", order: 9, active: true, text: { en: "Note anything running low for tomorrow — feed into the Ingredient Ordering Checklist", vi: "Ghi lại thứ sắp hết cho ngày mai — đưa vào Danh Sách Đặt Hàng Nguyên Liệu" }, linkHref: "/shopping" },
  { id: "cl_k_c_10", area: "kitchen", shift: "closing", order: 10, active: true, text: { en: "Cash up / reconcile the till, if applicable", vi: "Đối soát tiền mặt / két, nếu có" }, linkHref: "/sales" },
  { id: "cl_k_c_11", area: "kitchen", shift: "closing", order: 11, active: true, text: { en: "Final walk-through — all equipment off, all doors and windows locked before leaving", vi: "Kiểm tra vòng cuối — mọi thiết bị đã tắt, cửa ra vào và cửa sổ đã khóa trước khi ra về" } },

  // FOH — Opening
  { id: "cl_f_o_1", area: "foh", shift: "opening", order: 1, active: true, text: { en: "Tables clean, chairs arranged, cutlery/napkins/condiments set", vi: "Bàn sạch, ghế sắp gọn, dao nĩa/khăn giấy/gia vị đã chuẩn bị" } },
  { id: "cl_f_o_2", area: "foh", shift: "opening", order: 2, active: true, text: { en: "Every table's sauce, Pickled Veg (normal), and Spicy Pickles containers checked and topped up full", vi: "Kiểm tra và châm đầy sốt, Rau Củ Ngâm Chua (thường), và Dưa Chua Cay ở mỗi bàn" } },
  { id: "cl_f_o_3", area: "foh", shift: "opening", order: 3, active: true, text: { en: "Menus clean, stocked, no damaged or sticky copies", vi: "Thực đơn sạch, đủ số lượng, không rách hay dính bẩn" } },
  { id: "cl_f_o_4", area: "foh", shift: "opening", order: 4, active: true, text: { en: "EPOS/till system powered on and working", vi: "Hệ thống POS/két đã bật và hoạt động tốt" } },
  { id: "cl_f_o_5", area: "foh", shift: "opening", order: 5, active: true, text: { en: "Float counted and correct in the till", vi: "Đếm và xác nhận tiền quỹ đầu ca trong két" } },
  { id: "cl_f_o_6", area: "foh", shift: "opening", order: 6, active: true, text: { en: "Bar stocked — glasses, ice, garnishes, straws (once cocktails are live)", vi: "Quầy bar đủ hàng — ly, đá, nguyên liệu trang trí, ống hút (khi cocktail đã bán)" } },
  { id: "cl_f_o_7", area: "foh", shift: "opening", order: 7, active: true, text: { en: "Music and lighting/ambiance set for service", vi: "Nhạc và ánh sáng/không gian đã chuẩn bị cho ca phục vụ" } },
  { id: "cl_f_o_8", area: "foh", shift: "opening", order: 8, active: true, text: { en: "Restrooms checked — clean, stocked with paper and soap", vi: "Kiểm tra nhà vệ sinh — sạch sẽ, đủ giấy và xà phòng" } },
  { id: "cl_f_o_9", area: "foh", shift: "opening", order: 9, active: true, text: { en: "Reservation book/system checked for the day's bookings", vi: "Kiểm tra sổ/hệ thống đặt bàn cho các lượt đặt hôm nay" }, linkHref: "/bookings" },
  { id: "cl_f_o_10", area: "foh", shift: "opening", order: 10, active: true, text: { en: "Outdoor signage/menu board out, if used", vi: "Đặt bảng hiệu/thực đơn ngoài trời, nếu có dùng" } },
  { id: "cl_f_o_11", area: "foh", shift: "opening", order: 11, active: true, text: { en: "Entrance and front-of-house area clean and welcoming", vi: "Lối vào và khu vực phục vụ sạch sẽ, chào đón khách" } },
  { id: "cl_f_o_12", area: "foh", shift: "opening", order: 12, active: true, text: { en: "Staff briefed on today's specials (Roast Sunday, if applicable) and any 86'd items", vi: "Nhân viên được thông báo món đặc biệt hôm nay (Roast Sunday, nếu có) và các món hết hàng" } },
  { id: "cl_f_o_13", area: "foh", shift: "opening", order: 13, active: true, text: { en: "Uniforms and presentation standards checked before doors open", vi: "Kiểm tra đồng phục và diện mạo trước khi mở cửa" } },

  // FOH — Closing
  { id: "cl_f_c_1", area: "foh", shift: "closing", order: 1, active: true, text: { en: "Cash up / reconcile the till", vi: "Đối soát tiền mặt / két" }, linkHref: "/sales" },
  { id: "cl_f_c_2", area: "foh", shift: "closing", order: 2, active: true, text: { en: "Tables cleared, wiped down, and reset for tomorrow", vi: "Dọn bàn, lau sạch, và sắp lại cho ngày mai" } },
  { id: "cl_f_c_3", area: "foh", shift: "closing", order: 3, active: true, text: { en: "Chairs stacked or tucked in", vi: "Xếp chồng hoặc đẩy ghế vào gọn gàng" } },
  { id: "cl_f_c_4", area: "foh", shift: "closing", order: 4, active: true, text: { en: "Dining area floor swept/mopped", vi: "Quét/lau sàn khu vực ăn uống" } },
  { id: "cl_f_c_5", area: "foh", shift: "closing", order: 5, active: true, text: { en: "Restrooms cleaned and restocked", vi: "Vệ sinh và bổ sung đồ dùng nhà vệ sinh" } },
  { id: "cl_f_c_6", area: "foh", shift: "closing", order: 6, active: true, text: { en: "Bar cleaned, glasses washed, stock covered and stored", vi: "Vệ sinh quầy bar, rửa ly, che đậy và cất hàng" } },
  { id: "cl_f_c_7", area: "foh", shift: "closing", order: 7, active: true, text: { en: "Menus collected and checked for damage", vi: "Thu gom thực đơn và kiểm tra hư hỏng" } },
  { id: "cl_f_c_8", area: "foh", shift: "closing", order: 8, active: true, text: { en: "EPOS/till end-of-day report run and saved", vi: "Chạy và lưu báo cáo cuối ngày từ POS/két" }, linkHref: "/sales" },
  { id: "cl_f_c_9", area: "foh", shift: "closing", order: 9, active: true, text: { en: "Music and lights off", vi: "Tắt nhạc và đèn" } },
  { id: "cl_f_c_10", area: "foh", shift: "closing", order: 10, active: true, text: { en: "Outdoor signage brought in", vi: "Mang bảng hiệu ngoài trời vào" } },
  { id: "cl_f_c_11", area: "foh", shift: "closing", order: 11, active: true, text: { en: "Note any customer feedback or complaints for the manager to review", vi: "Ghi lại phản hồi hoặc khiếu nại của khách để quản lý xem xét" }, linkHref: "/food-safety/complaints" },
  { id: "cl_f_c_12", area: "foh", shift: "closing", order: 12, active: true, text: { en: "Float counted and secured for tomorrow", vi: "Đếm và cất tiền quỹ an toàn cho ngày mai" } },
  { id: "cl_f_c_13", area: "foh", shift: "closing", order: 13, active: true, text: { en: "Doors and windows locked before leaving", vi: "Khóa cửa ra vào và cửa sổ trước khi ra về" } },
];
