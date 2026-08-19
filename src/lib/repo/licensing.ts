import type { License, Bi, Role } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso, addDaysIso } from "@/lib/storage";
import { SEED_LICENSES } from "@/lib/seed/licensing";

const LICENSES_KEY = "licenses";

/** One completed renewal — what the expiry was, what it became, who changed it, when. */
export type LicenseRenewal = {
  /** The expiry that was replaced. null if the licence had no date on file before this. */
  previousExpiry: string | null;
  newExpiry: string | null;
  /** ISO timestamp of the change. */
  changedAt: string;
  changedBy: string;
  changedByRole: Role;
};

/**
 * A licence plus its renewal history. The history lives in this extended type
 * rather than in `License` itself because src/lib/types.ts is shared and owned
 * elsewhere; localStorage holds plain JSON, so the extra field round-trips
 * fine, and a `LicenseRecord` is still a `License` everywhere else in the app.
 */
export type LicenseRecord = License & { renewalHistory?: LicenseRenewal[] };

/** Who is making the change — a licence expiry is a compliance record, so it never changes anonymously. */
export type LicenseActor = { name: string; role: Role };

/** Renewals are kept per licence but bounded — this is a working record, not an audit archive, and localStorage is finite. */
const MAX_HISTORY = 20;

export function ensureLicensingSeeded() {
  if (isSeeded(LICENSES_KEY)) return;
  writeList(LICENSES_KEY, SEED_LICENSES);
  markSeeded(LICENSES_KEY);
}

export function getLicenses(): LicenseRecord[] {
  return readList<LicenseRecord>(LICENSES_KEY);
}

export function addLicense(name: Bi, expiryDate: string | null, renewalLeadDays: number, notes?: Bi): LicenseRecord {
  const entry: LicenseRecord = { id: newId("lic"), name, expiryDate, renewalLeadDays, notes };
  const all = getLicenses();
  all.push(entry);
  writeList(LICENSES_KEY, all);
  return entry;
}

/**
 * Patch a licence. Changing `expiryDate` is a renewal, so the previous value is
 * kept in `renewalHistory` with who changed it and when — an inspector asking
 * "when was this renewed and by whom?" needs an answer, and a silent overwrite
 * doesn't have one.
 */
export function updateLicense(id: string, patch: Partial<Omit<LicenseRecord, "id">>, actor: LicenseActor) {
  const all = getLicenses();
  const idx = all.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const current = all[idx];
  const next: LicenseRecord = { ...current, ...patch };

  if ("expiryDate" in patch && (patch.expiryDate ?? null) !== (current.expiryDate ?? null)) {
    const renewal: LicenseRenewal = {
      previousExpiry: current.expiryDate ?? null,
      newExpiry: patch.expiryDate ?? null,
      changedAt: new Date().toISOString(),
      changedBy: actor.name,
      changedByRole: actor.role,
    };
    next.renewalHistory = [renewal, ...(current.renewalHistory ?? [])].slice(0, MAX_HISTORY);
  }

  all[idx] = next;
  writeList(LICENSES_KEY, all);
}

/**
 * Local date + time of a stored renewal timestamp, as "YYYY-MM-DD HH:MM".
 * `changedAt` is stored in UTC, and slicing that ISO string directly would
 * show the wrong day for most of the evening in Vietnam (UTC+7) — the same
 * timezone trap `addDaysIso` documents.
 */
export function formatChangedAt(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return isoTimestamp;
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return `${local.slice(0, 10)} ${local.slice(11, 16)}`;
}

export function removeLicense(id: string) {
  writeList(
    LICENSES_KEY,
    getLicenses().filter((l) => l.id !== id)
  );
}

export type LicenseStatus = "not_set" | "valid" | "expiring" | "expired";

export function getLicenseStatus(license: License, today = todayIso()): LicenseStatus {
  if (!license.expiryDate) return "not_set";
  if (license.expiryDate < today) return "expired";
  const leadIso = addDaysIso(today, license.renewalLeadDays);
  if (license.expiryDate <= leadIso) return "expiring";
  return "valid";
}

export function getLicensesNeedingAttention(today = todayIso()): LicenseRecord[] {
  return getLicenses().filter((l) => {
    const status = getLicenseStatus(l, today);
    return status === "expiring" || status === "expired";
  });
}
