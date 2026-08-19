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

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, Bi> = {
  applied: { en: "Applied", vi: "Đã ứng tuyển" },
  interviewing: { en: "Interviewing", vi: "Đang phỏng vấn" },
  offered: { en: "Offered", vi: "Đã đề nghị" },
  hired: { en: "Hired", vi: "Đã tuyển" },
  rejected: { en: "Rejected", vi: "Từ chối" },
};

export const CANDIDATE_STATUS_ORDER: CandidateStatus[] = ["applied", "interviewing", "offered", "hired", "rejected"];
