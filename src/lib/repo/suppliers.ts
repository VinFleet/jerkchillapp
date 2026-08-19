import type { Supplier, RejectionRecord, SupplierEvaluation, SupplierCategory, SupplierQuote } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso } from "@/lib/storage";
import { SEED_SUPPLIERS, STANDARD_SUPPLIER_DOC_CHECKLIST } from "@/lib/seed/suppliers";

const SUPPLIERS_KEY = "suppliers";
const REJECTIONS_KEY = "supplier_rejections";
const EVALUATIONS_KEY = "supplier_evaluations";
const QUOTES_KEY = "supplier_quotes";
const KAMEREO_ENRICH_KEY = "suppliers_kamereo_enrich_v1";

export function ensureSuppliersSeeded() {
  if (!isSeeded(SUPPLIERS_KEY)) {
    writeList(SUPPLIERS_KEY, SEED_SUPPLIERS);
    markSeeded(SUPPLIERS_KEY);
    markSeeded(KAMEREO_ENRICH_KEY);
    return;
  }
  // One-time enrichment for browsers seeded before Kamereo's real business
  // registration / cert data (Food Safety Book Section 3.3) was available.
  // Only fills in fields the user hasn't already set — never overwrites a
  // real edit — and never runs more than once.
  if (!isSeeded(KAMEREO_ENRICH_KEY)) {
    const all = readList<Supplier>(SUPPLIERS_KEY);
    const idx = all.findIndex((s) => s.id === "sup_kamereo");
    const seedKamereo = SEED_SUPPLIERS.find((s) => s.id === "sup_kamereo");
    if (idx >= 0 && seedKamereo && !all[idx].businessRegNo) {
      all[idx] = { ...all[idx], ...seedKamereo };
      writeList(SUPPLIERS_KEY, all);
    }
    markSeeded(KAMEREO_ENRICH_KEY);
  }
}

export function toggleSupplierDocItem(supplierId: string, index: number) {
  const supplier = getSupplier(supplierId);
  if (!supplier?.documentChecklist) return;
  const documentChecklist = supplier.documentChecklist.map((item, i) =>
    i === index ? { ...item, checked: !item.checked } : item
  );
  updateSupplier(supplierId, { documentChecklist });
}

export function getSuppliers(): Supplier[] {
  return readList<Supplier>(SUPPLIERS_KEY);
}

export function getSupplier(id: string): Supplier | undefined {
  return getSuppliers().find((s) => s.id === id);
}

export function addSupplier(name: string, category: SupplierCategory): Supplier {
  const entry: Supplier = {
    id: newId("sup"),
    name,
    category,
    status: "review",
    // Every new supplier gets the standard Vietnamese compliance paperwork
    // checklist attached automatically, so onboarding one never skips it.
    documentChecklist: STANDARD_SUPPLIER_DOC_CHECKLIST.map((d) => ({ ...d })),
  };
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

// ---------- Supplier Price Quotes ----------

export function getQuotes(): SupplierQuote[] {
  return readList<SupplierQuote>(QUOTES_KEY).sort((a, b) => (a.quotedAt < b.quotedAt ? 1 : -1));
}

export function getQuotesForSupplier(supplierId: string): SupplierQuote[] {
  return getQuotes().filter((q) => q.supplierId === supplierId);
}

export function addQuote(input: Omit<SupplierQuote, "id" | "quotedAt"> & { quotedAt?: string }): SupplierQuote {
  const entry: SupplierQuote = { ...input, id: newId("quote"), quotedAt: input.quotedAt ?? todayIso() };
  const all = readList<SupplierQuote>(QUOTES_KEY);
  all.push(entry);
  writeList(QUOTES_KEY, all);
  return entry;
}

export function deleteQuote(id: string) {
  writeList(QUOTES_KEY, readList<SupplierQuote>(QUOTES_KEY).filter((q) => q.id !== id));
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
