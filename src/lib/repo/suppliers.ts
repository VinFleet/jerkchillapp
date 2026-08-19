import type { Supplier, RejectionRecord, SupplierEvaluation, SupplierCategory } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso } from "@/lib/storage";
import { SEED_SUPPLIERS } from "@/lib/seed/suppliers";

const SUPPLIERS_KEY = "suppliers";
const REJECTIONS_KEY = "supplier_rejections";
const EVALUATIONS_KEY = "supplier_evaluations";

export function ensureSuppliersSeeded() {
  if (isSeeded(SUPPLIERS_KEY)) return;
  writeList(SUPPLIERS_KEY, SEED_SUPPLIERS);
  markSeeded(SUPPLIERS_KEY);
}

export function getSuppliers(): Supplier[] {
  return readList<Supplier>(SUPPLIERS_KEY);
}

export function getSupplier(id: string): Supplier | undefined {
  return getSuppliers().find((s) => s.id === id);
}

export function addSupplier(name: string, category: SupplierCategory): Supplier {
  const entry: Supplier = { id: newId("sup"), name, category, status: "review" };
  const all = getSuppliers();
  all.push(entry);
  writeList(SUPPLIERS_KEY, all);
  return entry;
}

export function updateSupplier(id: string, patch: Partial<Omit<Supplier, "id">>) {
  const all = getSuppliers();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(SUPPLIERS_KEY, all);
}

// ---------- Goods Rejection / Defect Record ----------

export function getRejections(supplierId?: string): RejectionRecord[] {
  const all = readList<RejectionRecord>(REJECTIONS_KEY).sort((a, b) => (a.date < b.date ? 1 : -1));
  return supplierId ? all.filter((r) => r.supplierId === supplierId) : all;
}

export function logRejection(input: Omit<RejectionRecord, "id" | "date"> & { date?: string }): RejectionRecord {
  const entry: RejectionRecord = { ...input, id: newId("rej"), date: input.date ?? todayIso() };
  const all = readList<RejectionRecord>(REJECTIONS_KEY);
  all.push(entry);
  writeList(REJECTIONS_KEY, all);
  return entry;
}

// ---------- Supplier Periodic Evaluation ----------

export function getEvaluations(supplierId?: string): SupplierEvaluation[] {
  const all = readList<SupplierEvaluation>(EVALUATIONS_KEY).sort((a, b) => (a.evaluatedAt < b.evaluatedAt ? 1 : -1));
  return supplierId ? all.filter((e) => e.supplierId === supplierId) : all;
}

export function logEvaluation(
  input: Omit<SupplierEvaluation, "id" | "evaluatedAt">
): SupplierEvaluation {
  const entry: SupplierEvaluation = { ...input, id: newId("eval"), evaluatedAt: new Date().toISOString() };
  const all = readList<SupplierEvaluation>(EVALUATIONS_KEY);
  all.push(entry);
  writeList(EVALUATIONS_KEY, all);
  // The evaluation's decision feeds straight back into the supplier's status.
  updateSupplier(entry.supplierId, { status: entry.decision === "continue" ? "approved" : entry.decision, lastReviewed: todayIso() });
  return entry;
}
