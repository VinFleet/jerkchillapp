import type { Bi } from "@/lib/types";

// Real Code of Conduct + disciplinary policy text (OPERATIONS_AND_FOOD_SAFETY_DATA.md Part D).
// Shown to staff before they acknowledge, not just a bare "mark acknowledged" button.

export const CODE_OF_CONDUCT: Bi[] = [
  { en: "Punctuality: on shift and in uniform 10 minutes before the rostered start time.", vi: "Đúng giờ: có mặt và mặc đồng phục 10 phút trước giờ bắt đầu ca theo lịch." },
  { en: "Phones away from guest-facing and food-prep areas during service.", vi: "Không sử dụng điện thoại ở khu vực tiếp khách và khu vực chế biến thực phẩm trong ca làm việc." },
  { en: "All food-handling staff follow the Food Safety Compliance Suite without exception.", vi: "Tất cả nhân viên xử lý thực phẩm phải tuân thủ Bộ Quy Trình An Toàn Thực Phẩm không có ngoại lệ." },
  { en: "Cash and till discrepancies are reported to the Manager the same day.", vi: "Chênh lệch tiền mặt và máy tính tiền phải được báo cáo cho Quản lý ngay trong ngày." },
  { en: "Time-off swaps arranged directly between staff and confirmed with the Manager at least 48 hours ahead.", vi: "Đổi ca nghỉ được thỏa thuận trực tiếp giữa nhân viên và phải được Quản lý xác nhận trước ít nhất 48 giờ." },
  { en: "Guests are treated courteously at all times, including during complaints — escalate to the Manager rather than argue.", vi: "Luôn đối xử lịch sự với khách hàng, kể cả khi xử lý khiếu nại — báo lên Quản lý thay vì tranh cãi." },
  { en: "No alcohol served to anyone who appears underage or intoxicated; ID may be requested.", vi: "Không phục vụ rượu bia cho người có vẻ chưa đủ tuổi hoặc đã say; có thể yêu cầu xuất trình giấy tờ tùy thân." },
  { en: "Zero tolerance for discrimination, harassment, or bullying of guests or colleagues.", vi: "Không khoan nhượng với hành vi phân biệt đối xử, quấy rối, hoặc bắt nạt đối với khách hàng hoặc đồng nghiệp." },
];

export const DISCIPLINARY_POLICY: Bi = {
  en: "Verbal warning → written warning → final written warning → termination, each logged with date and detail. Theft, violence, and serious food-safety breaches that endanger guests skip straight to immediate dismissal.",
  vi: "Cảnh cáo miệng → cảnh cáo bằng văn bản → cảnh cáo cuối cùng bằng văn bản → chấm dứt hợp đồng, mỗi bước được ghi lại kèm ngày và chi tiết. Hành vi trộm cắp, bạo lực, và vi phạm an toàn thực phẩm nghiêm trọng gây nguy hiểm cho khách hàng sẽ bị sa thải ngay lập tức.",
};
