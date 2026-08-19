import type { ChecklistItem, ChecklistTick, Notice, NoticeAck, StockDayEntry } from "@/lib/types";

/**
 * The collections that are shared across devices.
 *
 * Deliberately not everything. These are the ones where a second device
 * seeing stale data actively breaks a promise the spec makes:
 *  - "Manager sees in real time whether the checklist is done before service"
 *  - "New checklist items added by the manager instantly appear on every device"
 *  - "Manager posts to all devices at once" (notice board replacing group chat)
 *  - the kitchen tablet counts stock, the owner reads it from their phone
 *
 * Reference data (recipes, suppliers, contacts) is seeded identically on every
 * device and rarely edited, and the legally-required food-safety logs are
 * deliberately left device-local for now — syncing tamper-evident records
 * needs its own careful design rather than being folded in here.
 */
export type SyncedCollection =
  | "checklist_items"
  | "checklist_ticks"
  | "notices"
  | "notice_acks"
  | "stock_entries";

type CollectionConfig = {
  /** the localStorage key the repo already writes to */
  storageKey: string;
  /** stable identity for a record, since not every type carries an `id` */
  idOf: (record: unknown) => string;
  /** when the record last changed locally, for last-write-wins */
  updatedAtOf: (record: unknown) => string;
};

const asRecord = (r: unknown) => r as Record<string, unknown>;

export const SYNCED_COLLECTIONS: Record<SyncedCollection, CollectionConfig> = {
  checklist_items: {
    storageKey: "checklist_items",
    idOf: (r) => (asRecord(r).id as string) ?? "",
    // ChecklistItem carries no timestamp; template edits are rare and always
    // by a manager, so push time is a fine ordering key.
    updatedAtOf: () => new Date().toISOString(),
  },
  checklist_ticks: {
    storageKey: "checklist_ticks",
    idOf: (r) => (asRecord(r).id as string) ?? "",
    updatedAtOf: (r) => (asRecord(r).checkedAt as string) ?? new Date().toISOString(),
  },
  notices: {
    storageKey: "notices",
    idOf: (r) => (asRecord(r).id as string) ?? "",
    updatedAtOf: (r) => (asRecord(r).createdAt as string) ?? new Date().toISOString(),
  },
  notice_acks: {
    storageKey: "notice_acks",
    // NoticeAck has no id of its own — one row per (notice, person).
    idOf: (r) => `${asRecord(r).noticeId}__${asRecord(r).staffName}`,
    updatedAtOf: (r) => (asRecord(r).ackedAt as string) ?? new Date().toISOString(),
  },
  stock_entries: {
    storageKey: "stock_entries",
    idOf: (r) => (asRecord(r).id as string) ?? "",
    updatedAtOf: (r) => (asRecord(r).updatedAt as string) ?? new Date().toISOString(),
  },
};

export const SYNCED_COLLECTION_IDS = Object.keys(SYNCED_COLLECTIONS) as SyncedCollection[];

export const STORAGE_KEY_TO_COLLECTION: Record<string, SyncedCollection> = Object.fromEntries(
  SYNCED_COLLECTION_IDS.map((id) => [SYNCED_COLLECTIONS[id].storageKey, id])
) as Record<string, SyncedCollection>;

/** Compile-time reminder that every synced type is accounted for above. */
export type SyncedRecordShape = ChecklistItem | ChecklistTick | Notice | NoticeAck | StockDayEntry;
