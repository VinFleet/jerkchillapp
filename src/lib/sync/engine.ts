import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import {
  readList,
  writeList,
  readValue,
  writeValue,
  getActiveTenant,
  registerSyncedKeys,
} from "@/lib/storage";
import {
  SYNCED_COLLECTIONS,
  SYNCED_COLLECTION_IDS,
  STORAGE_KEY_TO_COLLECTION,
  type SyncedCollection,
} from "@/lib/sync/collections";

/**
 * Local-first sync.
 *
 * Reads never touch the network — every screen renders from localStorage, so
 * the app is exactly as fast and as offline-tolerant as before. Supabase is
 * the shared copy: local writes are queued and pushed, remote changes are
 * pulled and merged, and Realtime makes a change on one device show up on
 * another within a second or so instead of on the next poll.
 *
 * Conflicts resolve last-write-wins per record. For this domain that is the
 * behaviour you actually want — the most recent stock count is the real one,
 * and the last person to tick a checklist item is the answer.
 */

const DIRTY_KEY = "sync_dirty";
const LAST_PULL_KEY = "sync_last_pull";
const PULL_OVERLAP_MS = 30_000;

export type SyncStatus = "off" | "not_set_up" | "offline" | "syncing" | "synced" | "error";

/**
 * PGRST205 = the table isn't in Supabase's schema cache, i.e. sync-schema.sql
 * hasn't been run yet. That's a setup step, not a fault — showing "can't reach
 * the server" would send someone debugging their wifi instead of running the
 * SQL, so it gets its own state and stops the retry loop.
 */
function isTableMissing(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  const message = (err as { message?: string } | null)?.message ?? "";
  return code === "PGRST205" || message.includes("synced_records");
}

type Listener = (status: SyncStatus, pendingCount: number) => void;

const listeners = new Set<Listener>();
let status: SyncStatus = supabaseConfigured ? "syncing" : "off";
let started = false;
let pulling = false;
let pushing = false;

function emit() {
  const pending = getDirty().length;
  listeners.forEach((l) => l(status, pending));
}

function setStatus(next: SyncStatus) {
  status = next;
  emit();
}

export function onSyncStatus(listener: Listener): () => void {
  listener(status, getDirty().length);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

// ---------- dirty tracking ----------

function getDirty(): SyncedCollection[] {
  return readValue<SyncedCollection[]>(DIRTY_KEY, []);
}

function markDirty(collection: SyncedCollection) {
  const dirty = getDirty();
  if (dirty.includes(collection)) return;
  writeValue(DIRTY_KEY, [...dirty, collection]);
}

function clearDirty(collections: SyncedCollection[]) {
  writeValue(
    DIRTY_KEY,
    getDirty().filter((c) => !collections.includes(c))
  );
}

// ---------- push ----------

type RemoteRow = {
  tenant_id: string;
  collection: string;
  record_id: string;
  data: Record<string, unknown>;
  deleted: boolean;
  updated_at: string;
};

/**
 * Pushes whole collections rather than individual edits. They're small (a
 * day's checklist ticks, the notice board), and it means a device that was
 * offline for a while converges in one round-trip instead of replaying a
 * queue that may have grown stale.
 */
async function pushCollection(collection: SyncedCollection): Promise<void> {
  if (!supabase) return;
  const config = SYNCED_COLLECTIONS[collection];
  const records = readList<unknown>(config.storageKey);
  const tenant = getActiveTenant();

  if (records.length === 0) return;

  const rows = records.map((record) => ({
    tenant_id: tenant,
    collection,
    record_id: config.idOf(record),
    data: record as Record<string, unknown>,
    deleted: false,
  }));

  const { error } = await supabase.from("synced_records").upsert(rows, {
    onConflict: "tenant_id,collection,record_id",
  });
  if (error) throw error;
}

export async function pushAll(): Promise<void> {
  if (!supabase || pushing) return;
  const dirty = getDirty();
  if (dirty.length === 0) return;

  pushing = true;
  setStatus("syncing");
  try {
    for (const collection of dirty) {
      await pushCollection(collection);
    }
    clearDirty(dirty);
    setStatus("synced");
  } catch (err) {
    if (isTableMissing(err)) setStatus("not_set_up");
    else setStatus(navigator.onLine ? "error" : "offline");
  } finally {
    pushing = false;
    emit();
  }
}

// ---------- pull ----------

/**
 * Merges a remote row into the local list. A record the local device has
 * pending (dirty) is left alone, so a change made offline isn't clobbered by
 * an older remote copy before it has had a chance to push.
 */
function mergeRows(collection: SyncedCollection, rows: RemoteRow[]): boolean {
  const config = SYNCED_COLLECTIONS[collection];
  if (getDirty().includes(collection)) return false;

  const local = readList<unknown>(config.storageKey);
  const byId = new Map(local.map((r) => [config.idOf(r), r]));
  let changed = false;

  for (const row of rows) {
    if (row.deleted) {
      if (byId.delete(row.record_id)) changed = true;
      continue;
    }
    const existing = byId.get(row.record_id);
    if (!existing) {
      byId.set(row.record_id, row.data);
      changed = true;
      continue;
    }
    // Last write wins. The server stamps updated_at, so a device with a wrong
    // clock can't permanently win or lose every conflict.
    const localAt = config.updatedAtOf(existing);
    if (new Date(row.updated_at).getTime() >= new Date(localAt).getTime()) {
      byId.set(row.record_id, row.data);
      changed = true;
    }
  }

  if (changed) writeList(config.storageKey, Array.from(byId.values()));
  return changed;
}

export async function pullAll(force = false): Promise<boolean> {
  if (!supabase || pulling) return false;
  pulling = true;
  setStatus("syncing");

  // Re-request a short window before the last pull: server clocks and
  // in-flight transactions mean a row committed at almost exactly lastPull
  // could otherwise be missed exactly once, and never seen again.
  const lastPull = force ? null : readValue<string | null>(LAST_PULL_KEY, null);
  const since = lastPull ? new Date(new Date(lastPull).getTime() - PULL_OVERLAP_MS).toISOString() : null;

  try {
    let query = supabase
      .from("synced_records")
      .select("*")
      .eq("tenant_id", getActiveTenant())
      .in("collection", SYNCED_COLLECTION_IDS);
    if (since) query = query.gt("updated_at", since);

    const { data, error } = await query;
    if (error) throw error;

    let anyChanged = false;
    const rows = (data ?? []) as RemoteRow[];
    for (const collection of SYNCED_COLLECTION_IDS) {
      const forCollection = rows.filter((r) => r.collection === collection);
      if (forCollection.length === 0) continue;
      if (mergeRows(collection, forCollection)) anyChanged = true;
    }

    writeValue(LAST_PULL_KEY, new Date().toISOString());
    setStatus("synced");
    if (anyChanged) notifyDataChanged();
    return anyChanged;
  } catch (err) {
    if (isTableMissing(err)) setStatus("not_set_up");
    else setStatus(navigator.onLine ? "error" : "offline");
    return false;
  } finally {
    pulling = false;
    emit();
  }
}

// ---------- data-changed fanout ----------

const dataListeners = new Set<() => void>();

/** Lets an open screen re-read local storage when a pull brings something new. */
export function onSyncedDataChanged(listener: () => void): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

function notifyDataChanged() {
  dataListeners.forEach((l) => l());
}

// ---------- lifecycle ----------

export async function syncNow(): Promise<void> {
  if (!supabase) return;
  // Once we know the table isn't there, stop hammering it every minute —
  // a manual tap on the indicator still retries, for right after the SQL runs.
  if (status === "not_set_up") return;
  await pushAll();
  await pullAll();
}

/** Retry after running sync-schema.sql, without needing a page reload. */
export async function retrySync(): Promise<void> {
  if (!supabase) return;
  setStatus("syncing");
  await pushAll();
  await pullAll();
}

export function startSync(): () => void {
  if (!supabaseConfigured || !supabase || started) return () => {};
  const client = supabase;
  started = true;

  registerSyncedKeys(Object.values(SYNCED_COLLECTIONS).map((c) => c.storageKey), (key) => {
    const collection = STORAGE_KEY_TO_COLLECTION[key];
    if (!collection) return;
    markDirty(collection);
    emit();
    void pushAll();
  });

  void syncNow();

  // Realtime: this is what makes "the manager sees it in real time" true,
  // rather than "within a minute".
  const channel = client
    .channel("synced_records_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "synced_records" },
      () => {
        void pullAll();
      }
    )
    .subscribe();

  const onOnline = () => void syncNow();
  const onFocus = () => void pullAll();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", () => setStatus("offline"));
  window.addEventListener("focus", onFocus);

  // Backstop for a dropped realtime socket or a device that slept.
  const interval = window.setInterval(() => void syncNow(), 60_000);

  return () => {
    started = false;
    window.clearInterval(interval);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
    void client.removeChannel(channel);
  };
}
