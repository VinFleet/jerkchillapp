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
  isAppendOnly,
  type SyncedCollection,
} from "@/lib/sync/collections";
import { uploadPendingPhotos } from "@/lib/photos/upload";

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
const PUSHED_KEY_PREFIX = "sync_pushed:";
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

/** Record ids already confirmed on the server, so immutable rows are pushed once rather than every sync. */
function getPushedIds(collection: SyncedCollection): Set<string> {
  return new Set(readValue<string[]>(`${PUSHED_KEY_PREFIX}${collection}`, []));
}

function addPushedIds(collection: SyncedCollection, ids: string[]) {
  const all = getPushedIds(collection);
  ids.forEach((id) => all.add(id));
  writeValue(`${PUSHED_KEY_PREFIX}${collection}`, Array.from(all));
}

/**
 * Pushes whole collections rather than individual edits — they're small, and
 * a device that was offline for a while converges in one round-trip instead
 * of replaying a queue that may have grown stale.
 *
 * The exception is immutable append-only records (a logged fridge check never
 * changes). Those are pushed once and then skipped: a delivery log carries
 * photos, and re-uploading months of them on every sync would be pointlessly
 * expensive on a phone's data plan.
 */
async function pushCollection(collection: SyncedCollection): Promise<void> {
  if (!supabase) return;
  const config = SYNCED_COLLECTIONS[collection];
  const records = readList<unknown>(config.storageKey);
  const tenant = getActiveTenant();
  if (records.length === 0) return;

  const skipAlreadyPushed = isAppendOnly(collection) && !config.mutable;
  const pushed = skipAlreadyPushed ? getPushedIds(collection) : null;
  const toPush = pushed ? records.filter((r) => !pushed.has(config.idOf(r))) : records;
  if (toPush.length === 0) return;

  // Photos push in small batches so one oversized request can't fail the
  // whole collection and strand a legally-required record on one device.
  const BATCH = 25;
  for (let i = 0; i < toPush.length; i += BATCH) {
    const slice = toPush.slice(i, i + BATCH);
    const rows = slice.map((record) => ({
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
    if (skipAlreadyPushed) addPushedIds(collection, slice.map((r) => config.idOf(r)));
  }
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
 * Merges remote rows into the local list.
 *
 * Append-only (food-safety) collections union: a record present on either
 * side survives, nothing is deleted, and where a record legitimately
 * progressed on both devices the collection's own reconcile decides — always
 * in a direction that loses no information. Because nothing can be lost,
 * these merge even while the device has unpushed changes; skipping would
 * leave a manager's phone missing checks the tablet already recorded.
 *
 * Mutable (operational) collections are last-write-wins, and are skipped
 * while dirty so an offline edit isn't clobbered by an older remote copy
 * before it has had a chance to push.
 */
function mergeRows(collection: SyncedCollection, rows: RemoteRow[]): boolean {
  const config = SYNCED_COLLECTIONS[collection];
  const appendOnly = isAppendOnly(collection);
  if (!appendOnly && getDirty().includes(collection)) return false;

  const local = readList<unknown>(config.storageKey);
  const byId = new Map(local.map((r) => [config.idOf(r), r]));
  let changed = false;

  for (const row of rows) {
    const existing = byId.get(row.record_id);

    if (appendOnly) {
      // A tombstone on a legal record means someone deleted history. Refuse
      // it — the local copy is evidence and stays.
      if (row.deleted) continue;
      if (!existing) {
        byId.set(row.record_id, row.data);
        changed = true;
        continue;
      }
      if (!config.reconcile) continue; // immutable: the two copies are the same record
      const merged = config.reconcile(existing, row.data);
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        byId.set(row.record_id, merged);
        changed = true;
      }
      continue;
    }

    if (row.deleted) {
      if (byId.delete(row.record_id)) changed = true;
      continue;
    }
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
  // Photos go up before the records are pulled, so a record that arrives on
  // another device already has a Storage path to resolve rather than a gap.
  await uploadPendingPhotos();
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
