import type {
  StaffMember,
  ShiftEntry,
  InductionStep,
  InductionRecord,
  ConductAck,
  DisciplinaryEntry,
  DisciplinaryLevel,
  TrainingRecord,
  HealthCert,
  Candidate,
  CandidateStatus,
  QuestionBankItem,
  InterviewScorecard,
  ScorecardEntry,
} from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso, addDaysIso } from "@/lib/storage";
import { INDUCTION_STEPS } from "@/lib/types";
import { SEED_QUESTIONS, SEED_STAFF_MEMBERS } from "@/lib/seed/staff";

const STAFF_KEY = "staff_members";
const SHIFTS_KEY = "staff_shifts";
const INDUCTION_KEY = "staff_induction";
const CONDUCT_KEY = "staff_conduct_acks";
const DISCIPLINARY_KEY = "staff_disciplinary";
const TRAINING_KEY = "staff_training";
const HEALTH_KEY = "staff_health_certs";
const CANDIDATES_KEY = "hiring_candidates";
const QUESTIONS_KEY = "hiring_questions";
const SCORECARDS_KEY = "hiring_scorecards";

export function ensureStaffSeeded() {
  if (!isSeeded(QUESTIONS_KEY)) {
    writeList(QUESTIONS_KEY, SEED_QUESTIONS);
    markSeeded(QUESTIONS_KEY);
  }
  if (!isSeeded(STAFF_KEY)) {
    writeList(STAFF_KEY, SEED_STAFF_MEMBERS);
    markSeeded(STAFF_KEY);
  }
}

// ---------- Staff directory ----------

export function getStaff(activeOnly = true): StaffMember[] {
  const all = readList<StaffMember>(STAFF_KEY);
  return activeOnly ? all.filter((s) => s.active) : all;
}

export function getStaffMember(id: string): StaffMember | undefined {
  return readList<StaffMember>(STAFF_KEY).find((s) => s.id === id);
}

export function addStaffMember(name: string, role: string): StaffMember {
  const entry: StaffMember = { id: newId("staff"), name, role, active: true };
  const all = readList<StaffMember>(STAFF_KEY);
  all.push(entry);
  writeList(STAFF_KEY, all);
  return entry;
}

export function updateStaffMember(id: string, patch: Partial<Omit<StaffMember, "id">>) {
  const all = readList<StaffMember>(STAFF_KEY);
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(STAFF_KEY, all);
}

// ---------- Rota ----------

export function getShiftsForWeek(staffId: string, weekDates: string[]): ShiftEntry[] {
  return readList<ShiftEntry>(SHIFTS_KEY).filter((s) => s.staffId === staffId && weekDates.includes(s.date));
}

export function getShift(staffId: string, date: string): ShiftEntry | undefined {
  return readList<ShiftEntry>(SHIFTS_KEY).find((s) => s.staffId === staffId && s.date === date);
}

export function setShift(staffId: string, date: string, startTime: string, endTime: string): ShiftEntry {
  const all = readList<ShiftEntry>(SHIFTS_KEY);
  const idx = all.findIndex((s) => s.staffId === staffId && s.date === date);
  if (idx >= 0) {
    all[idx] = { ...all[idx], startTime, endTime };
    writeList(SHIFTS_KEY, all);
    return all[idx];
  }
  const entry: ShiftEntry = { id: newId("shift"), staffId, date, startTime, endTime };
  all.push(entry);
  writeList(SHIFTS_KEY, all);
  return entry;
}

export function removeShift(staffId: string, date: string) {
  writeList(
    SHIFTS_KEY,
    readList<ShiftEntry>(SHIFTS_KEY).filter((s) => !(s.staffId === staffId && s.date === date))
  );
}

export function shiftHours(shift: ShiftEntry): number {
  const [sh, sm] = shift.startTime.split(":").map(Number);
  const [eh, em] = shift.endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, minutes) / 60;
}

export function weekDatesFrom(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
}

export function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(dateIso, diff);
}

// ---------- Induction ----------

export function getInductionRecords(staffId: string): InductionRecord[] {
  return readList<InductionRecord>(INDUCTION_KEY).filter((r) => r.staffId === staffId);
}

export function isInductionStepDone(staffId: string, step: InductionStep): boolean {
  return getInductionRecords(staffId).some((r) => r.step === step && r.doneAt !== null);
}

export function toggleInductionStep(staffId: string, step: InductionStep, doneBy: string) {
  const all = readList<InductionRecord>(INDUCTION_KEY);
  const idx = all.findIndex((r) => r.staffId === staffId && r.step === step);
  const currentlyDone = idx >= 0 && all[idx].doneAt !== null;
  if (idx >= 0) {
    all[idx] = { ...all[idx], doneAt: currentlyDone ? null : new Date().toISOString(), doneBy: currentlyDone ? null : doneBy };
  } else {
    all.push({ staffId, step, doneAt: new Date().toISOString(), doneBy });
  }
  writeList(INDUCTION_KEY, all);
}

export function getInductionCompletion(staffId: string): { done: number; total: number } {
  const done = INDUCTION_STEPS.filter((s) => isInductionStepDone(staffId, s)).length;
  return { done, total: INDUCTION_STEPS.length };
}

// ---------- Code of Conduct ----------

export function getConductAck(staffId: string): ConductAck | undefined {
  return readList<ConductAck>(CONDUCT_KEY).find((a) => a.staffId === staffId);
}

export function ackConduct(staffId: string) {
  if (getConductAck(staffId)) return;
  const all = readList<ConductAck>(CONDUCT_KEY);
  all.push({ staffId, ackedAt: new Date().toISOString() });
  writeList(CONDUCT_KEY, all);
}

// ---------- Disciplinary log ----------

export function getDisciplinaryEntries(staffId: string): DisciplinaryEntry[] {
  return readList<DisciplinaryEntry>(DISCIPLINARY_KEY)
    .filter((d) => d.staffId === staffId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function logDisciplinary(staffId: string, level: DisciplinaryLevel, detail: string, loggedBy: string): DisciplinaryEntry {
  const entry: DisciplinaryEntry = { id: newId("disc"), staffId, level, date: todayIso(), detail, loggedBy };
  const all = readList<DisciplinaryEntry>(DISCIPLINARY_KEY);
  all.push(entry);
  writeList(DISCIPLINARY_KEY, all);
  return entry;
}

// ---------- Training record ----------

export function getTrainingRecords(staffId: string): TrainingRecord[] {
  return readList<TrainingRecord>(TRAINING_KEY)
    .filter((t) => t.staffId === staffId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function logTraining(staffId: string, topic: string, loggedBy: string, refresherDue?: string, trainer?: string): TrainingRecord {
  const entry: TrainingRecord = { id: newId("train"), staffId, topic, date: todayIso(), refresherDue, trainer, loggedBy };
  const all = readList<TrainingRecord>(TRAINING_KEY);
  all.push(entry);
  writeList(TRAINING_KEY, all);
  return entry;
}

// ---------- Health certificate ----------

export function getHealthCert(staffId: string): HealthCert {
  return readList<HealthCert>(HEALTH_KEY).find((h) => h.staffId === staffId) ?? { staffId, expiryDate: null };
}

export function updateHealthCert(staffId: string, patch: Partial<Omit<HealthCert, "staffId">>) {
  const all = readList<HealthCert>(HEALTH_KEY);
  const idx = all.findIndex((h) => h.staffId === staffId);
  if (idx >= 0) all[idx] = { ...all[idx], ...patch };
  else all.push({ staffId, expiryDate: null, ...patch });
  writeList(HEALTH_KEY, all);
}

export function getExpiringHealthCerts(leadDays = 30, today = todayIso()): { staffId: string; expiryDate: string }[] {
  const leadIso = addDaysIso(today, leadDays);
  return readList<HealthCert>(HEALTH_KEY).filter(
    (h): h is { staffId: string; expiryDate: string } => h.expiryDate !== null && h.expiryDate <= leadIso
  );
}

// ---------- Hiring & recruitment ----------

export function getCandidates(): Candidate[] {
  return readList<Candidate>(CANDIDATES_KEY).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addCandidate(name: string, roleApplied: string, phone?: string, cvNote?: string): Candidate {
  const entry: Candidate = {
    id: newId("cand"),
    name,
    roleApplied,
    status: "applied",
    phone,
    cvNote,
    createdAt: new Date().toISOString(),
  };
  const all = readList<Candidate>(CANDIDATES_KEY);
  all.push(entry);
  writeList(CANDIDATES_KEY, all);
  return entry;
}

export function updateCandidateStatus(id: string, status: CandidateStatus) {
  const all = readList<Candidate>(CANDIDATES_KEY);
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status };
  writeList(CANDIDATES_KEY, all);
}

export function getQuestionBank(role?: string): QuestionBankItem[] {
  const all = readList<QuestionBankItem>(QUESTIONS_KEY);
  return role ? all.filter((q) => q.role === role) : all;
}

export function addQuestion(role: string, en: string, vi: string): QuestionBankItem {
  const entry: QuestionBankItem = { id: newId("q"), role, question: { en, vi } };
  const all = readList<QuestionBankItem>(QUESTIONS_KEY);
  all.push(entry);
  writeList(QUESTIONS_KEY, all);
  return entry;
}

export function getScorecards(candidateId: string): InterviewScorecard[] {
  return readList<InterviewScorecard>(SCORECARDS_KEY).filter((s) => s.candidateId === candidateId);
}

export function addScorecard(
  candidateId: string,
  interviewer: string,
  scores: ScorecardEntry[],
  overallNote?: string
): InterviewScorecard {
  const entry: InterviewScorecard = {
    id: newId("score"),
    candidateId,
    interviewer,
    date: todayIso(),
    scores,
    overallNote,
  };
  const all = readList<InterviewScorecard>(SCORECARDS_KEY);
  all.push(entry);
  writeList(SCORECARDS_KEY, all);
  return entry;
}
