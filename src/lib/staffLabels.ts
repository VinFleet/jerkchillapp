import type { InductionStep, DisciplinaryLevel, CandidateStatus, Bi } from "@/lib/types";

export const INDUCTION_STEP_LABEL: Record<InductionStep, Bi> = {
  contract: { en: "Contract signed", vi: "Đã ký hợp đồng" },
  uniform: { en: "Uniform issued", vi: "Đã cấp đồng phục" },
  food_safety_training: { en: "Food safety training logged", vi: "Đã đào tạo an toàn thực phẩm" },
  health_cert: { en: "Health certificate on file", vi: "Đã có giấy khám sức khỏe" },
  pos_access: { en: "POS access created", vi: "Đã tạo tài khoản POS" },
};

export const DISCIPLINARY_LEVEL_LABEL: Record<DisciplinaryLevel, Bi> = {
  verbal: { en: "Verbal warning", vi: "Cảnh cáo miệng" },
  written: { en: "Written warning", vi: "Cảnh cáo bằng văn bản" },
  final: { en: "Final warning", vi: "Cảnh cáo cuối cùng" },
};

/** Short form for the three-up level selector, where the full label won't fit. */
export const DISCIPLINARY_LEVEL_SHORT: Record<DisciplinaryLevel, Bi> = {
  verbal: { en: "Verbal", vi: "Miệng" },
  written: { en: "Written", vi: "Văn bản" },
  final: { en: "Final", vi: "Cuối cùng" },
};

/**
 * The one fixed list of roles. `StaffMember.role`, `Candidate.roleApplied` and
 * `QuestionBankItem.role` all have to match each other exactly — the interview
 * scorecard looks the question bank up by role string, so free text meant
 * "Chef" vs "Chef / Kitchen" silently produced a scorecard with no questions.
 * All three now pick from here instead of being typed by hand.
 */
export const STAFF_ROLES = ["Owner", "Manager", "Chef / Kitchen", "Bartender / FOH"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/** The role someone is most often hired into — the sensible default on new forms. */
export const DEFAULT_STAFF_ROLE: StaffRole = "Chef / Kitchen";

export const STAFF_ROLE_LABEL: Record<StaffRole, Bi> = {
  Owner: { en: "Owner", vi: "Chủ nhà hàng" },
  Manager: { en: "Manager", vi: "Quản lý" },
  "Chef / Kitchen": { en: "Chef / Kitchen", vi: "Bếp trưởng / Bếp" },
  "Bartender / FOH": { en: "Bartender / FOH", vi: "Pha chế / Phục vụ" },
};

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** Bilingual label for a stored role, falling back to records saved as free text. */
export function staffRoleLabel(role: string): Bi {
  return isStaffRole(role) ? STAFF_ROLE_LABEL[role] : { en: role, vi: role };
}

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, Bi> = {
  applied: { en: "Applied", vi: "Đã ứng tuyển" },
  interviewing: { en: "Interviewing", vi: "Đang phỏng vấn" },
  offered: { en: "Offered", vi: "Đã đề nghị" },
  hired: { en: "Hired", vi: "Đã tuyển" },
  rejected: { en: "Rejected", vi: "Từ chối" },
};

export const CANDIDATE_STATUS_ORDER: CandidateStatus[] = ["applied", "interviewing", "offered", "hired", "rejected"];
