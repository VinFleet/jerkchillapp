// Local-first persistence. Phase 1 has no backend — all module data lives in
// the browser (localStorage) so the app keeps working on unreliable kitchen
// wifi. Each key is namespaced per (future) restaurant tenant so the same
// storage layer can support multi-tenant later without a rewrite.

const TENANT_KEY = "jc_active_tenant";
const DEFAULT_TENANT = "jerk-and-chill-thao-dien";

export function getActiveTenant(): string {
  if (typeof window === "undefined") return DEFAULT_TENANT;
  return window.localStorage.getItem(TENANT_KEY) || DEFAULT_TENANT;
}

function nsKey(key: string): string {
  return `jc:${getActiveTenant()}:${key}`;
}

export function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(nsKey(key));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function writeList<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(nsKey(key), JSON.stringify(value));
}

export function readValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(nsKey(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeValue<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(nsKey(key), JSON.stringify(value));
}

export function isSeeded(key: string): boolean {
  return readValue<boolean>(`${key}:seeded`, false);
}

export function markSeeded(key: string): void {
  writeValue(`${key}:seeded`, true);
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${rand}`;
}

export function todayIso(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
