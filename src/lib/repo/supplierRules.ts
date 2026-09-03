/**
 * Whether a supplier's food-safety cert is due for renewal — kept pure and
 * import-free so it's testable without a browser, the same reasoning as
 * lib/repo/orderRules.ts and lib/repo/recipeRules.ts.
 *
 * A supplier's ATTP certificate had a date field on the record but nothing
 * ever compared it to today — it sat in a text field with no flag anywhere
 * in the app, unlike licensing's equivalent check. Same three-state logic
 * as that one. No per-supplier lead time is stored, so 30 days is a flat
 * default — long enough to actually act on a renewal, not so long the
 * warning fires for half the year.
 */

export type CertStatus = "not_set" | "expired" | "expiring" | "valid";

const CERT_RENEWAL_LEAD_DAYS = 30;

/** Add N days to an ISO date, as a plain string comparison — no Date object, no timezone to get wrong. */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function supplierCertStatus(expiryDate: string | undefined, today: string): CertStatus {
  if (!expiryDate) return "not_set";
  if (expiryDate < today) return "expired";
  if (expiryDate <= addDaysIso(today, CERT_RENEWAL_LEAD_DAYS)) return "expiring";
  return "valid";
}
