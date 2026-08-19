import type { DailySales, SalesChannel } from "@/lib/types";
import { readList, writeList, newId } from "@/lib/storage";

const SALES_KEY = "daily_sales";

const EMPTY_CHANNELS: Record<SalesChannel, number> = {
  eat_in: 0,
  takeaway: 0,
  shopee: 0,
  grab: 0,
};

function getAll(): DailySales[] {
  return readList<DailySales>(SALES_KEY);
}

export function getEntry(date: string): DailySales | undefined {
  return getAll().find((e) => e.date === date);
}

export function getRecentEntries(beforeDate: string, limit = 14): DailySales[] {
  return getAll()
    .filter((e) => e.date < beforeDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

export function getOrCreateEntry(date: string, enteredBy: string): DailySales {
  const existing = getEntry(date);
  if (existing) return existing;

  const [previous] = getRecentEntries(date, 1);
  const fresh: DailySales = {
    id: newId("sales"),
    date,
    channelAmountsVnd: { ...EMPTY_CHANNELS },
    cashSalesVnd: 0,
    posZReportTotalVnd: null,
    floatVnd: previous?.floatVnd ?? 0,
    cashCountedVnd: null,
    bankDropVnd: 0,
    enteredBy,
    updatedAt: new Date().toISOString(),
  };
  const all = getAll();
  all.push(fresh);
  writeList(SALES_KEY, all);
  return fresh;
}

export function updateEntry(
  date: string,
  patch: Partial<Omit<DailySales, "id" | "date" | "enteredBy" | "updatedAt">>,
  enteredBy: string
): DailySales {
  getOrCreateEntry(date, enteredBy);
  const all = getAll();
  const idx = all.findIndex((e) => e.date === date);
  all[idx] = { ...all[idx], ...patch, enteredBy, updatedAt: new Date().toISOString() };
  writeList(SALES_KEY, all);
  return all[idx];
}

export function totalSalesVnd(entry: DailySales): number {
  return Object.values(entry.channelAmountsVnd).reduce((sum, v) => sum + (v || 0), 0);
}

/** What should be in the drawer: float carried in + cash sales, minus whatever's already been dropped to the bank. */
export function expectedCashVnd(entry: DailySales): number {
  return entry.floatVnd + entry.cashSalesVnd - entry.bankDropVnd;
}

export function cashVarianceVnd(entry: DailySales): number | null {
  if (entry.cashCountedVnd === null) return null;
  return entry.cashCountedVnd - expectedCashVnd(entry);
}

/** Variance against the POS Z-report — the source of truth for what was actually rung up. */
export function zReportVarianceVnd(entry: DailySales): number | null {
  if (entry.posZReportTotalVnd === null) return null;
  return totalSalesVnd(entry) - entry.posZReportTotalVnd;
}
