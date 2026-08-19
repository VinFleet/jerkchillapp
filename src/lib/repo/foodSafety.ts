import type {
  FridgeUnit,
  TempReading,
  CookTempLog,
  DeliveryLog,
  CleaningTask,
  CleaningSignoff,
  ThreeStepInspection,
  ServicePeriod,
  FoodSample,
  SampleDestructionCheck,
  PestSighting,
  ComplaintLog,
  ComplaintCategory,
  ComplaintSeverity,
} from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId } from "@/lib/storage";
import { SEED_FRIDGE_UNITS, SEED_CLEANING_TASKS } from "@/lib/seed/foodSafety";

const UNITS_KEY = "fs_fridge_units";
const READINGS_KEY = "fs_temp_readings";
const COOK_KEY = "fs_cook_logs";
const DELIVERY_KEY = "fs_delivery_logs";
const CLEANING_TASKS_KEY = "fs_cleaning_tasks";
const CLEANING_SIGNOFFS_KEY = "fs_cleaning_signoffs";
const INSPECTIONS_KEY = "fs_inspections";
const SAMPLES_KEY = "fs_samples";
const DESTRUCTION_CHECKS_KEY = "fs_sample_destruction_checks";
const PEST_KEY = "fs_pest";
const COMPLAINTS_KEY = "fs_complaints";

export function ensureFoodSafetySeeded() {
  if (!isSeeded(UNITS_KEY)) {
    writeList(UNITS_KEY, SEED_FRIDGE_UNITS);
    markSeeded(UNITS_KEY);
  }
  if (!isSeeded(CLEANING_TASKS_KEY)) {
    writeList(CLEANING_TASKS_KEY, SEED_CLEANING_TASKS);
    markSeeded(CLEANING_TASKS_KEY);
  }
}

// ---------- Fridge & Freezer Temperature Log ----------

export function getFridgeUnits(): FridgeUnit[] {
  return readList<FridgeUnit>(UNITS_KEY).filter((u) => u.active);
}

function getAllReadings(): TempReading[] {
  return readList<TempReading>(READINGS_KEY);
}

/** Current readings for a date — corrected entries are excluded in favor of their replacement. */
export function getTempReadingsForDate(date: string): TempReading[] {
  const all = getAllReadings().filter((r) => r.date === date);
  const supersededIds = new Set(all.map((r) => r.correctionOfId).filter(Boolean));
  return all.filter((r) => !supersededIds.has(r.id));
}

export function getReadingHistory(unitId: string, limit = 30): TempReading[] {
  return getAllReadings()
    .filter((r) => r.unitId === unitId)
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1))
    .slice(0, limit);
}

export function logTempReading(
  unit: FridgeUnit,
  date: string,
  timeSlot: "am" | "pm",
  tempC: number,
  loggedBy: string,
  correctiveAction?: string
): TempReading {
  const inRange = tempC >= unit.targetMinC && tempC <= unit.targetMaxC;
  const entry: TempReading = {
    id: newId("temp"),
    unitId: unit.id,
    date,
    timeSlot,
    tempC,
    inRange,
    correctiveAction,
    loggedBy,
    loggedAt: new Date().toISOString(),
  };
  const all = getAllReadings();
  all.push(entry);
  writeList(READINGS_KEY, all);
  return entry;
}

/** Tamper-evident correction: the original row stays, a new row supersedes it. */
export function correctTempReading(
  originalId: string,
  tempC: number,
  loggedBy: string,
  correctiveAction?: string
): TempReading | undefined {
  const all = getAllReadings();
  const original = all.find((r) => r.id === originalId);
  if (!original) return undefined;
  const unit = getFridgeUnits().find((u) => u.id === original.unitId);
  if (!unit) return undefined;
  const inRange = tempC >= unit.targetMinC && tempC <= unit.targetMaxC;
  const correction: TempReading = {
    ...original,
    id: newId("temp"),
    tempC,
    inRange,
    correctiveAction,
    loggedBy,
    loggedAt: new Date().toISOString(),
    correctionOfId: original.id,
  };
  all.push(correction);
  writeList(READINGS_KEY, all);
  return correction;
}

export function getOutOfRangeCount(date: string): number {
  return getTempReadingsForDate(date).filter((r) => !r.inRange).length;
}

// ---------- Cooking / Core Temperature Log ----------

function getAllCookLogs(): CookTempLog[] {
  return readList<CookTempLog>(COOK_KEY);
}

export function getCookLogs(limit = 50): CookTempLog[] {
  const all = getAllCookLogs();
  const supersededIds = new Set(all.map((r) => r.correctionOfId).filter(Boolean));
  return all
    .filter((r) => !supersededIds.has(r.id))
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1))
    .slice(0, limit);
}

export function logCookTemp(dish: string, batchLabel: string, probeTempC: number, loggedBy: string, correctiveAction?: string): CookTempLog {
  const entry: CookTempLog = {
    id: newId("cook"),
    dish,
    batchLabel,
    probeTempC,
    targetMet: probeTempC >= 75,
    correctiveAction,
    loggedBy,
    loggedAt: new Date().toISOString(),
  };
  const all = getAllCookLogs();
  all.push(entry);
  writeList(COOK_KEY, all);
  return entry;
}

// ---------- Delivery / Receiving Log ----------

export function getDeliveryLogs(limit = 50): DeliveryLog[] {
  return readList<DeliveryLog>(DELIVERY_KEY)
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1))
    .slice(0, limit);
}

export function logDelivery(input: Omit<DeliveryLog, "id" | "loggedAt">): DeliveryLog {
  const entry: DeliveryLog = { ...input, id: newId("del"), loggedAt: new Date().toISOString() };
  const all = readList<DeliveryLog>(DELIVERY_KEY);
  all.push(entry);
  writeList(DELIVERY_KEY, all);
  return entry;
}

// ---------- Cleaning Schedule ----------

export function getCleaningTasks(): CleaningTask[] {
  return readList<CleaningTask>(CLEANING_TASKS_KEY).filter((t) => t.active);
}

export function getSignoffsForDate(date: string): CleaningSignoff[] {
  return readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY).filter((s) => s.date === date);
}

export function isCleaningSignedOff(taskId: string, date: string): boolean {
  return getSignoffsForDate(date).some((s) => s.taskId === taskId);
}

export function signOffCleaning(taskId: string, date: string, signedBy: string): CleaningSignoff {
  const all = readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY);
  const existing = all.find((s) => s.taskId === taskId && s.date === date);
  if (existing) return existing;
  const entry: CleaningSignoff = { id: newId("clean"), taskId, date, signedBy, signedAt: new Date().toISOString() };
  all.push(entry);
  writeList(CLEANING_SIGNOFFS_KEY, all);
  return entry;
}

export function undoCleaningSignoff(taskId: string, date: string) {
  const all = readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY);
  writeList(
    CLEANING_SIGNOFFS_KEY,
    all.filter((s) => !(s.taskId === taskId && s.date === date))
  );
}

// ---------- Three-Step Food Inspection ----------
// QĐ 1246/QĐ-BYT: three legally-distinct checks, not one uniform pass/fail.

export function getInspectionsForDate(date: string): ThreeStepInspection[] {
  return readList<ThreeStepInspection>(INSPECTIONS_KEY).filter((i) => i.date === date);
}

/** Pass/fail is derived from whichever fields apply to that stage — there's no single stored flag. */
export function inspectionPassed(i: ThreeStepInspection): boolean {
  if (i.stage === "before") return i.sensoryOk === true;
  if (i.stage === "during") return i.areaHygieneOk === true && i.staffHygieneOk === true;
  return i.sensoryOk === true;
}

export type LogBeforePrepInput = {
  date: string;
  service: ServicePeriod;
  meal: string;
  ingredient: string;
  supplierSource: string;
  qty: string;
  sensoryOk: boolean;
  checkedBy: string;
  notes?: string;
};

export type LogDuringPrepInput = {
  date: string;
  service: ServicePeriod;
  meal: string;
  areaHygieneOk: boolean;
  staffHygieneOk: boolean;
  startTime: string;
  endTime: string;
  checkedBy: string;
  notes?: string;
};

export type LogBeforeServingInput = {
  date: string;
  service: ServicePeriod;
  meal: string;
  dish: string;
  sensoryOk: boolean;
  timeServed: string;
  checkedBy: string;
  notes?: string;
};

function pushInspection(entry: ThreeStepInspection) {
  const all = readList<ThreeStepInspection>(INSPECTIONS_KEY);
  all.push(entry);
  writeList(INSPECTIONS_KEY, all);
  return entry;
}

export function logBeforePrep(input: LogBeforePrepInput): ThreeStepInspection {
  return pushInspection({
    id: newId("insp"),
    stage: "before",
    checkedAt: new Date().toISOString(),
    ...input,
  });
}

export function logDuringPrep(input: LogDuringPrepInput): ThreeStepInspection {
  return pushInspection({
    id: newId("insp"),
    stage: "during",
    checkedAt: new Date().toISOString(),
    ...input,
  });
}

export function logBeforeServing(input: LogBeforeServingInput): ThreeStepInspection {
  return pushInspection({
    id: newId("insp"),
    stage: "before_serving",
    checkedAt: new Date().toISOString(),
    ...input,
  });
}

// ---------- Food Sample Retention ----------

export function getSamples(limit = 100): FoodSample[] {
  return readList<FoodSample>(SAMPLES_KEY)
    .sort((a, b) => (a.servedAt < b.servedAt ? 1 : -1))
    .slice(0, limit);
}

export function logSample(dish: string, qty: string, storageLocation: string, loggedBy: string): FoodSample {
  const servedAt = new Date();
  const discardBy = new Date(servedAt.getTime() + 24 * 3_600_000);
  const entry: FoodSample = {
    id: newId("sample"),
    dish,
    qty,
    servedAt: servedAt.toISOString(),
    storageLocation,
    discardBy: discardBy.toISOString(),
    discarded: false,
    discardedAt: null,
    loggedBy,
  };
  const all = readList<FoodSample>(SAMPLES_KEY);
  all.push(entry);
  writeList(SAMPLES_KEY, all);
  return entry;
}

export function markSampleDiscarded(id: string) {
  const all = readList<FoodSample>(SAMPLES_KEY);
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], discarded: true, discardedAt: new Date().toISOString() };
  writeList(SAMPLES_KEY, all);
}

/** Samples past their 24h minimum that haven't been discarded yet — the weekly check flags these. */
export function getOverdueSamples(): FoodSample[] {
  const now = new Date().toISOString();
  return getSamples().filter((s) => !s.discarded && s.discardBy < now);
}

// ---------- Weekly Sample Destruction Check ----------

export function getDestructionChecks(limit = 52): SampleDestructionCheck[] {
  return readList<SampleDestructionCheck>(DESTRUCTION_CHECKS_KEY)
    .sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1))
    .slice(0, limit);
}

export function logDestructionCheck(
  weekOf: string,
  allDiscarded: boolean,
  storageCleaned: boolean,
  checkedBy: string,
  issuesFound?: string
): SampleDestructionCheck {
  const entry: SampleDestructionCheck = {
    id: newId("destroy"),
    weekOf,
    allDiscarded,
    storageCleaned,
    issuesFound,
    checkedBy,
    checkedAt: new Date().toISOString(),
  };
  const all = readList<SampleDestructionCheck>(DESTRUCTION_CHECKS_KEY);
  all.push(entry);
  writeList(DESTRUCTION_CHECKS_KEY, all);
  return entry;
}

// ---------- Pest Control Log ----------

export function getPestSightings(): PestSighting[] {
  return readList<PestSighting>(PEST_KEY).sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

export function logPestSighting(date: string, location: string, action: string, reportedTo: string, loggedBy: string): PestSighting {
  const entry: PestSighting = {
    id: newId("pest"),
    date,
    location,
    action,
    reportedTo,
    status: "open",
    loggedBy,
    loggedAt: new Date().toISOString(),
  };
  const all = readList<PestSighting>(PEST_KEY);
  all.push(entry);
  writeList(PEST_KEY, all);
  return entry;
}

export function resolvePestSighting(id: string) {
  const all = readList<PestSighting>(PEST_KEY);
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status: "resolved" };
  writeList(PEST_KEY, all);
}

export function getOpenPestCount(): number {
  return getPestSightings().filter((p) => p.status === "open").length;
}

// ---------- Customer Complaint / Incident Log ----------

export function getComplaints(): ComplaintLog[] {
  return readList<ComplaintLog>(COMPLAINTS_KEY).sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

export function logComplaint(
  date: string,
  guestName: string,
  category: ComplaintCategory,
  description: string,
  severity: ComplaintSeverity,
  loggedBy: string,
  guestContact?: string,
  reportedToAuthority?: boolean
): ComplaintLog {
  const entry: ComplaintLog = {
    id: newId("complaint"),
    date,
    guestName,
    guestContact,
    category,
    description,
    severity,
    reportedToAuthority,
    loggedBy,
    loggedAt: new Date().toISOString(),
  };
  const all = readList<ComplaintLog>(COMPLAINTS_KEY);
  all.push(entry);
  writeList(COMPLAINTS_KEY, all);
  return entry;
}

export function updateComplaintOutcome(id: string, investigation: string, outcome: string) {
  const all = readList<ComplaintLog>(COMPLAINTS_KEY);
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], investigation, outcome };
  writeList(COMPLAINTS_KEY, all);
}

// ---------- Date-range queries, for the inspector-ready export ----------

export function getTempReadingsInRange(from: string, to: string): TempReading[] {
  const all = getAllReadings().filter((r) => r.date >= from && r.date <= to);
  const supersededIds = new Set(all.map((r) => r.correctionOfId).filter(Boolean));
  return all.filter((r) => !supersededIds.has(r.id)).sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

export function getCookLogsInRange(from: string, to: string): CookTempLog[] {
  return getCookLogs(5000).filter((r) => {
    const d = r.loggedAt.slice(0, 10);
    return d >= from && d <= to;
  });
}

export function getDeliveryLogsInRange(from: string, to: string): DeliveryLog[] {
  return getDeliveryLogs(5000).filter((r) => r.date >= from && r.date <= to);
}

export function getCleaningSignoffsInRange(from: string, to: string): CleaningSignoff[] {
  return readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY)
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => (a.signedAt < b.signedAt ? 1 : -1));
}

export function getInspectionsInRange(from: string, to: string): ThreeStepInspection[] {
  return readList<ThreeStepInspection>(INSPECTIONS_KEY)
    .filter((i) => i.date >= from && i.date <= to)
    .sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));
}

export function getSamplesInRange(from: string, to: string): FoodSample[] {
  return getSamples(5000).filter((s) => {
    const d = s.servedAt.slice(0, 10);
    return d >= from && d <= to;
  });
}

export function getPestInRange(from: string, to: string): PestSighting[] {
  return getPestSightings().filter((p) => p.date >= from && p.date <= to);
}

export function getComplaintsInRange(from: string, to: string): ComplaintLog[] {
  return getComplaints().filter((c) => c.date >= from && c.date <= to);
}
