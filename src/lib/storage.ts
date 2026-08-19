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

/**
 * Raised when the browser's storage is full. Every write goes through here so
 * a failed save is never silent — legally-required food-safety records must
 * not appear to save and then not exist.
 */
export class StorageFullError extends Error {
  constructor() {
    super("Storage is full");
    this.name = "StorageFullError";
  }
}

type StorageListener = (full: boolean) => void;
const storageListeners = new Set<StorageListener>();

/** Subscribe to storage-full state so the shell can show a persistent warning. */
export function onStorageFull(listener: StorageListener): () => void {
  storageListeners.add(listener);
  return () => storageListeners.delete(listener);
}

let storageIsFull = false;

export function isStorageFull(): boolean {
  return storageIsFull;
}

function setStorageFull(full: boolean) {
  if (storageIsFull === full) return;
  storageIsFull = full;
  storageListeners.forEach((l) => l(full));
}

function safeSet(key: string, serialized: string): void {
  try {
    window.localStorage.setItem(key, serialized);
    setStorageFull(false);
  } catch {
    // QuotaExceededError (name varies by browser; Safari private mode throws
    // a plain error). Either way the write did not happen — surface it.
    setStorageFull(true);
    throw new StorageFullError();
  }
}

/**
 * Keys the sync engine mirrors to Supabase. Registered at startup rather than
 * imported, so this module stays dependency-free (every repo imports it).
 * Hooking writes here means every write path is caught automatically —
 * including one-time migrations — without each repo remembering to opt in.
 */
const syncedKeys = new Set<string>();
let onSyncedWrite: ((key: string) => void) | null = null;

export function registerSyncedKeys(keys: string[], notify: (key: string) => void): void {
  keys.forEach((k) => syncedKeys.add(k));
  onSyncedWrite = notify;
}

export function writeList<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  safeSet(nsKey(key), JSON.stringify(value));
  if (syncedKeys.has(key)) onSyncedWrite?.(key);
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
  safeSet(nsKey(key), JSON.stringify(value));
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

/**
 * Add (or subtract) days from a YYYY-MM-DD date, in local time. Re-applying
 * the timezone offset before toISOString() is required — without it, any
 * timezone ahead of UTC (e.g. Vietnam, UTC+7) silently loses a day, because
 * local midnight is already the previous UTC calendar date.
 */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
