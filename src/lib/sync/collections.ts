import type {
  ChecklistItem,
  ChecklistTick,
  Notice,
  NoticeAck,
  StockDayEntry,
  CleaningSignoff,
  ComplaintLog,
  ComplaintRevision,
  FoodSample,
  PestSighting,
} from "@/lib/types";

/**
 * The collections that are shared across devices.
 *
 * Two families, with genuinely different merge rules:
 *
 *  - Operational data (checklists, notices, stock) is *mutable*: the most
 *    recent stock count is the real one, and the last person to tick an item
 *    is the answer. Last-write-wins is correct here.
 *
 *  - Food-safety logs are *append-only legal records*. Nothing is ever
 *    overwritten or deleted — a correction writes a new row pointing at the
 *    one it supersedes. Last-write-wins would be actively wrong: two devices
 *    logging different fridge checks would silently destroy one of them.
 *    These merge by union, and a record can only ever move forward.
 *
 * Reference data (recipes, suppliers, contacts, the fridge unit and cleaning
 * task lists) is deliberately excluded — it seeds identically on every device
 * and syncing it would add risk for no benefit.
 */
export type SyncedCollection =
  // operational — last-write-wins
  | "checklist_items"
  | "checklist_ticks"
  | "notices"
  | "notice_acks"
  | "stock_entries"
  | "orders"
  | "order_payments"
  | "menu_items"
  | "table_tokens"
  | "receipt_settings"
  // food safety — append-only
  | "fs_temp_readings"
  | "fs_cook_logs"
  | "fs_delivery_logs"
  | "fs_cleaning_signoffs"
  | "fs_inspections"
  | "fs_samples"
  | "fs_sample_destruction_checks"
  | "fs_pest"
  | "fs_complaints";

export type MergePolicy = "last-write-wins" | "append-only";

type CollectionConfig = {
  /** the localStorage key the repo already writes to */
  storageKey: string;
  /** stable identity for a record, since not every type carries an `id` */
  idOf: (record: unknown) => string;
  /** when the record last changed locally, for last-write-wins */
  updatedAtOf: (record: unknown) => string;
  /** defaults to last-write-wins */
  policy?: MergePolicy;
  /**
   * Only for append-only records that still legitimately progress — a
   * sign-off gets withdrawn, a sample gets discarded, a complaint gains an
   * outcome. Must return a record that loses no information from either side.
   * Absent means the record is fully immutable and the two copies are equal.
   */
  reconcile?: (local: unknown, remote: unknown) => unknown;
  /** True when a record can change after it's written, so it must be re-pushed rather than pushed once. */
  mutable?: boolean;
};

const asRecord = (r: unknown) => r as Record<string, unknown>;
const idField = (r: unknown) => (asRecord(r).id as string) ?? "";
const nowIso = () => new Date().toISOString();

/** Earlier of two ISO timestamps — the first person to act is the honest record. */
function earliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

/**
 * A withdrawal is terminal and one-way: once a sign-off has been withdrawn it
 * stays withdrawn. If both devices withdrew it, the first one is the truth.
 */
function reconcileSignoff(localRaw: unknown, remoteRaw: unknown): unknown {
  const local = localRaw as CleaningSignoff;
  const remote = remoteRaw as CleaningSignoff;
  if (!local.revokedAt && !remote.revokedAt) return local;
  if (local.revokedAt && !remote.revokedAt) return local;
  if (remote.revokedAt && !local.revokedAt) return remote;
  return earliest(local.revokedAt, remote.revokedAt) === local.revokedAt ? local : remote;
}

/** Discarding a retained sample is one-way — it can't come back. */
function reconcileSample(localRaw: unknown, remoteRaw: unknown): unknown {
  const local = localRaw as FoodSample;
  const remote = remoteRaw as FoodSample;
  if (local.discarded === remote.discarded) return local;
  const discarded = local.discarded ? local : remote;
  return { ...discarded, discardedAt: earliest(local.discardedAt ?? undefined, remote.discardedAt ?? undefined) ?? discarded.discardedAt };
}

/**
 * A confirmed payment cannot become unconfirmed.
 *
 * Last-write-wins is wrong here in one specific and expensive way: the till
 * marks a card payment pending, a webhook on the server confirms it, and a
 * stale tablet then pushes its older pending copy over the top. The bill would
 * read unpaid with the money already in the account.
 */
function reconcilePayment(localRaw: unknown, remoteRaw: unknown): unknown {
  type P = {
    status: string;
    confirmedAt?: string;
    slipPhotoPath?: string;
    providerRef?: string;
  };
  const local = localRaw as P;
  const remote = remoteRaw as P;
  const rank = (s: string) => (s === "refunded" ? 3 : s === "paid" ? 2 : s === "failed" ? 1 : 0);

  let winner: P;
  if (rank(local.status) !== rank(remote.status)) {
    winner = rank(local.status) > rank(remote.status) ? local : remote;
  } else if (local.status === "paid") {
    // Same status on both sides — keep the earliest confirmation, since that
    // is when the money actually moved.
    winner = earliest(local.confirmedAt, remote.confirmedAt) === local.confirmedAt ? local : remote;
  } else {
    winner = local;
  }

  // Evidence survives whichever side wins. A slip photographed on one device
  // and a reference typed on another are both facts about the same payment,
  // and the merge must never make either disappear.
  return {
    ...winner,
    slipPhotoPath: winner.slipPhotoPath ?? local.slipPhotoPath ?? remote.slipPhotoPath,
    providerRef: winner.providerRef ?? local.providerRef ?? remote.providerRef,
  };
}

/** A pest sighting can be resolved but never un-resolved. */
function reconcilePest(localRaw: unknown, remoteRaw: unknown): unknown {
  const local = localRaw as PestSighting;
  const remote = remoteRaw as PestSighting;
  if (local.status === remote.status) return local;
  return local.status === "resolved" ? local : remote;
}

/**
 * The one case where two devices can genuinely write different text for the
 * same field. Neither version is discarded: the revision histories are merged
 * and whichever current text loses becomes a revision, so an allergy
 * investigation can never be silently overwritten by a second device.
 */
function reconcileComplaint(localRaw: unknown, remoteRaw: unknown): unknown {
  const local = localRaw as ComplaintLog;
  const remote = remoteRaw as ComplaintLog;

  // One key for every revision, including the concurrent-edit one added
  // below — keying those two differently duplicates the same revision on
  // every re-merge, which grows without bound.
  const revisionKey = (r: ComplaintRevision) =>
    `${r.replacedAt}__${r.replacedBy}__${r.investigation ?? ""}__${r.outcome ?? ""}`;
  const merged = new Map<string, ComplaintRevision>();
  for (const r of [...(local.revisions ?? []), ...(remote.revisions ?? [])]) merged.set(revisionKey(r), r);

  const sameCurrent = local.investigation === remote.investigation && local.outcome === remote.outcome;
  if (sameCurrent) {
    return { ...local, revisions: Array.from(merged.values()).sort((a, b) => (a.replacedAt < b.replacedAt ? -1 : 1)) };
  }

  // The winner must be chosen from the records' *content*, never from which
  // side happens to be "local" — otherwise each device picks itself and the
  // two never converge. (Comparing loggedAt doesn't help: it's the same
  // record, so the timestamps are identical.) Deeper history wins first,
  // then a plain lexicographic tiebreak, which is arbitrary but identical
  // on every device. Nothing is lost either way — the loser's text is kept
  // as a revision below.
  const currentText = (c: ComplaintLog) => `${c.investigation ?? ""} ${c.outcome ?? ""}`;
  const localDepth = (local.revisions ?? []).length;
  const remoteDepth = (remote.revisions ?? []).length;
  const localWins =
    localDepth !== remoteDepth ? localDepth > remoteDepth : currentText(local) > currentText(remote);
  const winner = localWins ? local : remote;
  const loser = localWins ? remote : local;

  if (loser.investigation || loser.outcome) {
    // replacedAt has to be derived from the data too — a wall clock would
    // differ per device and the two would rewrite each other forever.
    const replacedAt = (local.loggedAt ?? "") >= (remote.loggedAt ?? "") ? local.loggedAt : remote.loggedAt;
    const concurrent: ComplaintRevision = {
      investigation: loser.investigation,
      outcome: loser.outcome,
      replacedBy: `${loser.loggedBy} — recorded on another device at the same time`,
      replacedAt,
    };
    merged.set(revisionKey(concurrent), concurrent);
  }

  return { ...winner, revisions: Array.from(merged.values()).sort((a, b) => (a.replacedAt < b.replacedAt ? -1 : 1)) };
}

export const SYNCED_COLLECTIONS: Record<SyncedCollection, CollectionConfig> = {
  // ---------- Operational: last-write-wins ----------
  orders: {
    storageKey: "orders",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).updatedAt as string) ?? nowIso(),
    // An order is a living record — lines are added, statuses advance — so it
    // must be re-pushed on every change rather than pushed once.
    mutable: true,
  },
  order_payments: {
    storageKey: "order_payments",
    idOf: idField,
    // A payment carries no updatedAt: it is created, then confirmed once. The
    // confirmation timestamp is the only change that matters, so it orders on
    // that and falls back to creation.
    updatedAtOf: (r) =>
      (asRecord(r).confirmedAt as string) ?? (asRecord(r).createdAt as string) ?? nowIso(),
    mutable: true,
    reconcile: reconcilePayment,
  },
  // The menu and the table tokens sync for one reason: a guest's phone has
  // neither. It opens /order/<token> as a stranger with an empty local store,
  // so the server has to answer "which table is this, and what can they
  // order" — and the only shared copy of either is synced_records.
  //
  // This also closes a quieter gap. Until now a price the owner changed on
  // their laptop never reached the kitchen tablet, because the menu was
  // reference data that seeds identically on every device. It stopped being
  // that the moment prices became editable.
  menu_items: {
    storageKey: "menu_items",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).updatedAt as string) ?? nowIso(),
    mutable: true,
  },
  // The bill's letterhead — one record, owner-edited, printed everywhere.
  // Syncs for the same reason menu_items does: a header typed on the laptop
  // must print identically from the tablet.
  receipt_settings: {
    storageKey: "receipt_settings",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).updatedAt as string) ?? nowIso(),
    mutable: true,
  },
  table_tokens: {
    storageKey: "table_tokens",
    // Keyed by the token itself, not an id — a TableToken has no id field, and
    // the token is what a URL resolves against, so it is the natural identity.
    idOf: (r) => (asRecord(r).token as string) ?? "",
    // Rotation revokes the old row and writes a new one, so a revoked token
    // must order after the record that created it.
    updatedAtOf: (r) =>
      (asRecord(r).revokedAt as string) ?? (asRecord(r).createdAt as string) ?? nowIso(),
    mutable: true,
  },
  checklist_items: {
    storageKey: "checklist_items",
    idOf: idField,
    // ChecklistItem carries no timestamp; template edits are rare and always
    // by a manager, so push time is a fine ordering key.
    updatedAtOf: nowIso,
  },
  checklist_ticks: {
    storageKey: "checklist_ticks",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).checkedAt as string) ?? nowIso(),
  },
  notices: {
    storageKey: "notices",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).createdAt as string) ?? nowIso(),
  },
  notice_acks: {
    storageKey: "notice_acks",
    // NoticeAck has no id of its own — one row per (notice, person).
    idOf: (r) => `${asRecord(r).noticeId}__${asRecord(r).staffName}`,
    updatedAtOf: (r) => (asRecord(r).ackedAt as string) ?? nowIso(),
  },
  stock_entries: {
    storageKey: "stock_entries",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).updatedAt as string) ?? nowIso(),
  },

  // ---------- Food safety: append-only legal records ----------
  fs_temp_readings: {
    storageKey: "fs_temp_readings",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).loggedAt as string) ?? nowIso(),
    policy: "append-only",
  },
  fs_cook_logs: {
    storageKey: "fs_cook_logs",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).loggedAt as string) ?? nowIso(),
    policy: "append-only",
  },
  fs_delivery_logs: {
    storageKey: "fs_delivery_logs",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).loggedAt as string) ?? nowIso(),
    policy: "append-only",
  },
  fs_cleaning_signoffs: {
    storageKey: "fs_cleaning_signoffs",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).revokedAt as string) ?? (asRecord(r).signedAt as string) ?? nowIso(),
    policy: "append-only",
    reconcile: reconcileSignoff,
    mutable: true,
  },
  fs_inspections: {
    storageKey: "fs_inspections",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).checkedAt as string) ?? nowIso(),
    policy: "append-only",
  },
  fs_samples: {
    storageKey: "fs_samples",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).discardedAt as string) ?? (asRecord(r).servedAt as string) ?? nowIso(),
    policy: "append-only",
    reconcile: reconcileSample,
    mutable: true,
  },
  fs_sample_destruction_checks: {
    storageKey: "fs_sample_destruction_checks",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).checkedAt as string) ?? nowIso(),
    policy: "append-only",
  },
  fs_pest: {
    storageKey: "fs_pest",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).loggedAt as string) ?? nowIso(),
    policy: "append-only",
    reconcile: reconcilePest,
    mutable: true,
  },
  fs_complaints: {
    storageKey: "fs_complaints",
    idOf: idField,
    updatedAtOf: (r) => (asRecord(r).loggedAt as string) ?? nowIso(),
    policy: "append-only",
    reconcile: reconcileComplaint,
    mutable: true,
  },
};

export const SYNCED_COLLECTION_IDS = Object.keys(SYNCED_COLLECTIONS) as SyncedCollection[];

export function isAppendOnly(collection: SyncedCollection): boolean {
  return SYNCED_COLLECTIONS[collection].policy === "append-only";
}

export const STORAGE_KEY_TO_COLLECTION: Record<string, SyncedCollection> = Object.fromEntries(
  SYNCED_COLLECTION_IDS.map((id) => [SYNCED_COLLECTIONS[id].storageKey, id])
) as Record<string, SyncedCollection>;

/** Compile-time reminder that every synced type is accounted for above. */
export type SyncedRecordShape = ChecklistItem | ChecklistTick | Notice | NoticeAck | StockDayEntry;
