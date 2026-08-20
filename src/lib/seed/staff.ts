import type { QuestionBankItem, StaffMember } from "@/lib/types";
import type { StaffRole } from "@/lib/staffLabels";

// The seed roles are pinned to the fixed role list, not free text — the
// scorecard matches a candidate's role against the question bank by exact
// string, so a drifted seed value would silently produce an empty scorecard.
type SeededStaff = Omit<StaffMember, "role"> & { role: StaffRole };
type SeededQuestion = Omit<QuestionBankItem, "role"> & { role: StaffRole };

// Real roster structure from OPERATIONS_AND_FOOD_SAFETY_DATA.md Part D — day
// off per role is known, but real staff names aren't, so these seed as
// named placeholders the Owner fills in, not invented people.
export const SEED_STAFF_MEMBERS: SeededStaff[] = [
  { id: "staff_head_chef", name: "Head Chef (add name)", role: "Chef / Kitchen", dayOff: "mon", active: true },
  { id: "staff_kitchen_1", name: "Kitchen Assistant 1 (add name)", role: "Chef / Kitchen", dayOff: "tue", active: true },
  { id: "staff_kitchen_2", name: "Kitchen Assistant 2 (add name)", role: "Chef / Kitchen", dayOff: "wed", active: true },
  { id: "staff_kitchen_3", name: "Kitchen Assistant 3 (add name)", role: "Chef / Kitchen", dayOff: "thu", active: true },
  { id: "staff_foh_1", name: "FOH 1 (add name)", role: "Bartender / FOH", dayOff: "mon", active: true },
  { id: "staff_foh_2", name: "FOH 2 (add name)", role: "Bartender / FOH", dayOff: "tue", active: true },
  { id: "staff_manager", name: "Manager / Owner (add name)", role: "Manager", dayOff: "sun", active: true },
];

// A starter question bank per role — reusable, tailor per candidate. Not
// staff records, just an interview template, so safe to pre-fill.

export const SEED_QUESTIONS: SeededQuestion[] = [
  { id: "q_kitchen_1", role: "Chef / Kitchen", question: { en: "Tell me about a time service got slammed — what did you do?", vi: "Kể về lúc bếp quá tải — bạn đã làm gì?" } },
  { id: "q_kitchen_2", role: "Chef / Kitchen", question: { en: "How do you handle a dish sent back by a guest?", vi: "Bạn xử lý thế nào khi món ăn bị khách trả lại?" } },
  { id: "q_kitchen_3", role: "Chef / Kitchen", question: { en: "What food safety habits do you never skip?", vi: "Thói quen an toàn thực phẩm nào bạn không bao giờ bỏ qua?" } },
  { id: "q_foh_1", role: "Bartender / FOH", question: { en: "How would you handle a guest with an allergy at a busy table?", vi: "Bạn xử lý thế nào khi khách bị dị ứng vào lúc đông bàn?" } },
  { id: "q_foh_2", role: "Bartender / FOH", question: { en: "Describe a time you turned an unhappy guest around.", vi: "Kể về lần bạn làm hài lòng một khách đang không vui." } },
  { id: "q_foh_3", role: "Bartender / FOH", question: { en: "What does great hospitality look like to you?", vi: "Theo bạn, dịch vụ tốt là như thế nào?" } },
];
