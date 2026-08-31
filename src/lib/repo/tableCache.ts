import { readList, writeList } from "@/lib/storage";
import { STARTER_FLOOR_PLAN } from "@/lib/bookings/repo";

/**
 * A local copy of the floor plan, so ordering survives the wifi dropping.
 *
 * Tables are the one piece of reference data that lives in Postgres rather
 * than on the device, because the public booking form has to see them and a
 * guest's browser has no local store of ours. That is right for bookings and
 * wrong for the till: a waiter halfway through a table's order does not stop
 * because the router rebooted, and "which tables exist" is the least volatile
 * fact in the building.
 *
 * So the live list is authoritative whenever it can be reached, and this
 * mirrors it on every successful fetch. Reads fall back in order: cache, then
 * the starter plan compiled into the app. The last step matters on a device
 * that has never once been online — it is still the real room, because the
 * seed is the real room.
 */

const CACHE_KEY = "table_cache";

export type CachedTable = {
  id: string;
  tableNumber: string;
  seats: number;
};

/** Sort I2 before I10, and indoor before outdoor — humans read them that way. */
function byTableNumber(a: CachedTable, b: CachedTable): number {
  const parse = (n: string) => {
    const m = /^([A-Za-z]*)(\d*)$/.exec(n.trim());
    return { zone: m?.[1] ?? n, seq: m?.[2] ? Number(m[2]) : 0 };
  };
  const pa = parse(a.tableNumber);
  const pb = parse(b.tableNumber);
  return pa.zone === pb.zone ? pa.seq - pb.seq : pa.zone.localeCompare(pb.zone);
}

/**
 * The prefix on a fallback table's id.
 *
 * The compiled-in floor plan exists so a device that has never been online
 * still knows the room. Those ids are for display only — the real ones are
 * UUIDs from Postgres — and anything that binds a record to a table must
 * refuse to use them. See isRealTableId.
 */
const SEED_ID_PREFIX = "seed:";

/**
 * Whether this id identifies a real table, rather than a placeholder from the
 * offline fallback.
 *
 * Worth the ceremony because of what happened without it: the QR sticker page
 * minted a token against `seed:I1` before the live floor plan arrived, then a
 * second token against the real UUID. Two codes per table, and an order placed
 * through the first would carry a tableId no table has — so the kitchen would
 * see the ticket while the floor screen still showed that table empty.
 */
export function isRealTableId(id: string): boolean {
  return !id.startsWith(SEED_ID_PREFIX);
}

export function cacheTables(tables: CachedTable[]): void {
  // An empty live list means the owner has not built the floor plan yet, not
  // that the room has no tables. Caching it would replace a working fallback
  // with nothing.
  if (tables.length === 0) return;
  writeList(CACHE_KEY, [...tables].sort(byTableNumber));
}

export function getCachedTables(): CachedTable[] {
  const cached = readList<CachedTable>(CACHE_KEY);
  if (cached.length > 0) return cached;

  // Never been online. The seed ids are synthetic — a real fetch replaces
  // them — but the numbers are what a waiter taps and what the kitchen reads.
  return STARTER_FLOOR_PLAN.map((t) => ({
    id: `${SEED_ID_PREFIX}${t.table_number}`,
    tableNumber: t.table_number,
    seats: t.seats,
  })).sort(byTableNumber);
}

/** Whether what we are showing is a real fetch or the compiled-in fallback. */
export function tablesAreCached(): boolean {
  return readList<CachedTable>(CACHE_KEY).length > 0;
}
