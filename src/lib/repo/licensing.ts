import type { License } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, todayIso, addDaysIso } from "@/lib/storage";
import { SEED_LICENSES } from "@/lib/seed/licensing";

const LICENSES_KEY = "licenses";

export function ensureLicensingSeeded() {
  if (isSeeded(LICENSES_KEY)) return;
  writeList(LICENSES_KEY, SEED_LICENSES);
  markSeeded(LICENSES_KEY);
}

export function getLicenses(): License[] {
  return readList<License>(LICENSES_KEY);
}

export function addLicense(name: { en: string; vi: string }, expiryDate: string, renewalLeadDays: number): License {
  const entry: License = { id: newId("lic"), name, expiryDate, renewalLeadDays };
  const all = getLicenses();
  all.push(entry);
  writeList(LICENSES_KEY, all);
  return entry;
}

export function updateLicense(id: string, patch: Partial<Omit<License, "id">>) {
  const all = getLicenses();
  const idx = all.findIndex((l) => l.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(LICENSES_KEY, all);
}

export type LicenseStatus = "not_set" | "valid" | "expiring" | "expired";

export function getLicenseStatus(license: License, today = todayIso()): LicenseStatus {
  if (!license.expiryDate) return "not_set";
  if (license.expiryDate < today) return "expired";
  const leadIso = addDaysIso(today, license.renewalLeadDays);
  if (license.expiryDate <= leadIso) return "expiring";
  return "valid";
}

export function getLicensesNeedingAttention(today = todayIso()): License[] {
  return getLicenses().filter((l) => {
    const status = getLicenseStatus(l, today);
    return status === "expiring" || status === "expired";
  });
}
