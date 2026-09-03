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
import { readList, writeList, isSeeded, markSeeded, newId, isLegacyTenant } from "@/lib/storage";
import { SEED_FRIDGE_UNITS, SEED_CLEANING_TASKS } from "@/lib/seed/foodSafety";
import { raiseAlert } from "@/lib/push/alert";

// v2: real units on site replaced the earlier placeholder names — bumping
// the key forces a fresh seed for anyone whose browser already stored the
// old placeholder list (writeList/isSeeded never overwrite existing data).
const UNITS_KEY = "fs_fridge_units_v2";
const READINGS_KEY = "fs_temp_readings";
const COOK_KEY = "fs_cook_logs";
const DELIVERY_KEY = "fs_delivery_logs";
// v2: corrected "Walk-in fridge" Vietnamese label to match the Food Safety
// Book exactly ("Kho lạnh", not "Tủ lạnh lớn"). Task ids are unchanged, so
// existing sign-off records still link correctly.
// v3: renamed the "Walk-in fridge" area to match the units actually on site.
const CLEANING_TASKS_KEY = "fs_cleaning_tasks_v3";
const CLEANING_SIGNOFFS_KEY = "fs_cleaning_signoffs";
const INSPECTIONS_KEY = "fs_inspections";
const SAMPLES_KEY = "fs_samples";
const DESTRUCTION_CHECKS_KEY = "fs_sample_destruction_checks";
const PEST_KEY = "fs_pest";
const COMPLAINTS_KEY = "fs_complaints";

/**
 * Local calendar day of an ISO timestamp. `slice(0, 10)` would give the *UTC*
 * day, which in Vietnam (UTC+7) is still yesterday's date until 07:00 local.
 */
function localDayOf(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/**
 * Same clock time, different calendar day. A check remembered the next morning
 * can't recover the exact minute it happened, but the day is what the record
 * legally turns on — so a backdated entry keeps the current time on the chosen
 * date rather than inventing one.
 */
function atSameTimeOn(date: string, at: Date): Date {
  const d = new Date(date + "T00:00:00");
  d.setHours(at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds());
  return d;
}

export function ensureFoodSafetySeeded() {
  // SEED_FRIDGE_UNITS and SEED_CLEANING_TASKS are Jerk & Chill's actual
  // kitchen — their exact fridge count, a cleaning grid written around
  // having no walk-in. A new branch starts with neither: fridges are now
  // something an owner adds from the real equipment catalog (see
  // lib/repo/equipmentCatalog.ts), not something the app should guess at.
  if (!isLegacyTenant()) {
    markSeeded(UNITS_KEY);
    markSeeded(CLEANING_TASKS_KEY);
    return;
  }
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

/**
 * Add a fridge or freezer — from the catalog, or typed in by hand.
 *
 * A synced, mutable record (unlike most reference data): an owner adding a
 * new fridge from the office laptop must show up on the kitchen tablet the
 * same day, because that is where readings get logged against it.
 */
export function addFridgeUnit(input: {
  name: { en: string; vi: string };
  kind: FridgeUnit["kind"];
  targetMinC: number;
  targetMaxC: number;
  catalogId?: string;
  brand?: string;
  model?: string;
  capacityLiters?: number;
}): FridgeUnit {
  const unit: FridgeUnit = {
    id: newId("fu"),
    active: true,
    updatedAt: new Date().toISOString(),
    ...input,
  };
  writeList(UNITS_KEY, [...readList<FridgeUnit>(UNITS_KEY), unit]);
  return unit;
}

export function updateFridgeUnit(id: string, patch: Partial<Omit<FridgeUnit, "id">>) {
  const all = readList<FridgeUnit>(UNITS_KEY);
  writeList(
    UNITS_KEY,
    all.map((u) => (u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u))
  );
}

/** Retired rather than deleted — its logged readings must keep meaning something. */
export function deactivateFridgeUnit(id: string) {
  updateFridgeUnit(id, { active: false });
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

/**
 * `CookTempLog` has no date of its own — a batch's day is read off `loggedAt`.
 * A batch probed during service but only written up the next morning still has
 * to sit on the day it was actually cooked, and moving `loggedAt` to do that
 * would falsify the other half of the record (when it was really entered). So
 * a row carries `cookedOn` alongside a truthful `loggedAt`, and every read of a
 * batch's day goes through `cookDate()`.
 */
export type CookTempRow = CookTempLog & { cookedOn?: string };

/** The day the batch was cooked. Rows written before `cookedOn` existed fall back to their entry day. */
export function cookDate(log: CookTempRow): string {
  return log.cookedOn ?? localDayOf(log.loggedAt);
}

/** True when the batch was written up on a different day from the one it records. */
export function isLateCookEntry(log: CookTempRow): boolean {
  return cookDate(log) !== localDayOf(log.loggedAt);
}

function getAllCookLogs(): CookTempRow[] {
  return readList<CookTempRow>(COOK_KEY);
}

export function getCookLogs(limit = 50): CookTempRow[] {
  const all = getAllCookLogs();
  const supersededIds = new Set(all.map((r) => r.correctionOfId).filter(Boolean));
  return all
    .filter((r) => !supersededIds.has(r.id))
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1))
    .slice(0, limit);
}

export function logCookTemp(
  date: string,
  dish: string,
  batchLabel: string,
  probeTempC: number,
  loggedBy: string,
  correctiveAction?: string
): CookTempRow {
  const entry: CookTempRow = {
    id: newId("cook"),
    dish,
    batchLabel,
    probeTempC,
    targetMet: probeTempC >= 75,
    correctiveAction,
    loggedBy,
    loggedAt: new Date().toISOString(),
    cookedOn: date,
  };
  const all = getAllCookLogs();
  all.push(entry);
  writeList(COOK_KEY, all);
  return entry;
}

/** Tamper-evident correction: the original row stays, a new row supersedes it. */
export function correctCookTemp(
  originalId: string,
  probeTempC: number,
  loggedBy: string,
  correctiveAction?: string
): CookTempRow | undefined {
  const all = getAllCookLogs();
  const original = all.find((r) => r.id === originalId);
  if (!original) return undefined;
  const correction: CookTempRow = {
    ...original,
    id: newId("cook"),
    probeTempC,
    targetMet: probeTempC >= 75,
    correctiveAction,
    loggedBy,
    loggedAt: new Date().toISOString(),
    cookedOn: cookDate(original),
    correctionOfId: original.id,
  };
  all.push(correction);
  writeList(COOK_KEY, all);
  return correction;
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

/** All sign-off rows for a date, including revoked ones (the export needs to show those). */
export function getSignoffsForDate(date: string): CleaningSignoff[] {
  return readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY).filter((s) => s.date === date);
}

/** Only counts as signed off if it hasn't since been withdrawn. */
export function isCleaningSignedOff(taskId: string, date: string): boolean {
  return getSignoffsForDate(date).some((s) => s.taskId === taskId && !s.revokedAt);
}

export function signOffCleaning(taskId: string, date: string, signedBy: string): CleaningSignoff {
  const all = readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY);
  const active = all.find((s) => s.taskId === taskId && s.date === date && !s.revokedAt);
  if (active) return active;
  const entry: CleaningSignoff = { id: newId("clean"), taskId, date, signedBy, signedAt: new Date().toISOString() };
  all.push(entry);
  writeList(CLEANING_SIGNOFFS_KEY, all);
  return entry;
}

/**
 * Withdraws a sign-off without deleting it — the original row stays, stamped
 * with who reversed it and why, so the inspector-ready export still shows the
 * full history. Deleting the row instead would make the log tamper-*able*,
 * which the compliance requirement explicitly forbids.
 */
export function revokeCleaningSignoff(taskId: string, date: string, revokedBy: string, reason: string) {
  const all = readList<CleaningSignoff>(CLEANING_SIGNOFFS_KEY);
  const idx = all.findIndex((s) => s.taskId === taskId && s.date === date && !s.revokedAt);
  if (idx < 0) return;
  all[idx] = { ...all[idx], revokedBy, revokedAt: new Date().toISOString(), revokedReason: reason };
  writeList(CLEANING_SIGNOFFS_KEY, all);
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

/**
 * `date` is the day the dish was *served*, not the day the row was typed — a
 * sample written up the morning after service belongs to that service, and its
 * 24-hour hold has to run from then (so a backdated sample is correctly already
 * due for discard).
 */
export function logSample(date: string, dish: string, qty: string, storageLocation: string, loggedBy: string): FoodSample {
  const servedAt = atSameTimeOn(date, new Date());
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
  raiseAlert({
    category: "issues",
    title: { en: `Complaint logged — ${severity}`, vi: `Khiếu nại mới — ${severity}` },
    // The guest's own words, so this is the untrusted half; the server escapes
    // Zalo mention patterns before it reaches the group.
    body: { en: `${category}: ${description}`, vi: `${category}: ${description}` },
    url: "/food-safety/complaints",
    urgent: severity === "high",
  });

  return entry;
}

/**
 * Records an investigation/outcome. Any previous version is pushed onto
 * `revisions` rather than being overwritten — this is the log most likely to
 * matter in an allergy incident, so the earlier wording, who replaced it and
 * when all have to survive.
 */
export function updateComplaintOutcome(id: string, investigation: string, outcome: string, updatedBy: string) {
  const all = readList<ComplaintLog>(COMPLAINTS_KEY);
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const prev = all[idx];
  const hadPrevious = Boolean(prev.investigation || prev.outcome);
  const unchanged = prev.investigation === investigation && prev.outcome === outcome;
  if (unchanged) return;
  all[idx] = {
    ...prev,
    investigation,
    outcome,
    revisions: hadPrevious
      ? [
          ...(prev.revisions ?? []),
          {
            investigation: prev.investigation,
            outcome: prev.outcome,
            replacedBy: updatedBy,
            replacedAt: new Date().toISOString(),
          },
        ]
      : prev.revisions,
  };
  writeList(COMPLAINTS_KEY, all);
}

// ---------- Date-range queries, for the inspector-ready export ----------

export function getTempReadingsInRange(from: string, to: string): TempReading[] {
  const all = getAllReadings().filter((r) => r.date >= from && r.date <= to);
  const supersededIds = new Set(all.map((r) => r.correctionOfId).filter(Boolean));
  return all.filter((r) => !supersededIds.has(r.id)).sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

export function getCookLogsInRange(from: string, to: string): CookTempRow[] {
  return getCookLogs(5000).filter((r) => {
    const d = cookDate(r);
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
    const d = localDayOf(s.servedAt);
    return d >= from && d <= to;
  });
}

export function getPestInRange(from: string, to: string): PestSighting[] {
  return getPestSightings().filter((p) => p.date >= from && p.date <= to);
}

export function getComplaintsInRange(from: string, to: string): ComplaintLog[] {
  return getComplaints().filter((c) => c.date >= from && c.date <= to);
}
