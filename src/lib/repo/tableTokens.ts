import { readList, writeList, newId } from "@/lib/storage";
import { isRealTableId } from "@/lib/repo/tableCache";

/**
 * The token in a table's QR code.
 *
 * Deliberately NOT the table number. A guessable `/order/I4` lets anyone
 * standing outside order food to any table in the room, and the first time
 * that happens during a service nobody will work out why.
 *
 * Reference data: it seeds once per table and never changes, so it does not
 * sync — the QR sticker on the table is the thing that carries it.
 */

const TOKENS_KEY = "table_tokens";

export type TableToken = {
  /** The random part that appears in the URL. */
  token: string;
  tableId: string;
  createdAt: string;
  /** Set when a sticker is reprinted, so an old photographed QR stops working. */
  revokedAt?: string;
};

function randomToken(): string {
  // Unambiguous alphabet: no O/0, no I/1/l. These get read aloud across a
  // room and typed by hand when a QR will not scan.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Drop codes minted against a placeholder table id.
 *
 * These were created by an earlier version of the stickers page, which ran
 * before the live floor plan arrived and bound a code to `seed:I1` rather than
 * to the real table. They are unreachable by design — resolveToken would hand
 * back a tableId no table has — so removing them loses nothing.
 *
 * Safe to run repeatedly, and safe against real codes: it only ever removes
 * ones whose table id is a placeholder. Not guarded by isSeeded() because it
 * must also clean up a device that generated them after the guard would have
 * been set.
 */
export function dropPlaceholderTokens(): number {
  const all = readList<TableToken>(TOKENS_KEY);
  const keep = all.filter((t) => isRealTableId(t.tableId));
  if (keep.length !== all.length) writeList(TOKENS_KEY, keep);
  return all.length - keep.length;
}

export function getTokenFor(tableId: string): TableToken | undefined {
  return readList<TableToken>(TOKENS_KEY).find((t) => t.tableId === tableId && !t.revokedAt);
}

export function resolveToken(token: string): TableToken | undefined {
  return readList<TableToken>(TOKENS_KEY).find((t) => t.token === token && !t.revokedAt);
}

/** Issues a token for a table, reusing the live one so a sticker stays valid. */
export function ensureToken(tableId: string): TableToken {
  const existing = getTokenFor(tableId);
  if (existing) return existing;

  const created: TableToken = {
    token: randomToken(),
    tableId,
    createdAt: new Date().toISOString(),
  };
  writeList(TOKENS_KEY, [...readList<TableToken>(TOKENS_KEY), created]);
  return created;
}

/**
 * Retire a token and issue a new one.
 *
 * For when a QR has been photographed and is being used from outside, or a
 * sticker is reprinted. The old token stops resolving immediately.
 */
export function rotateToken(tableId: string): TableToken {
  const all = readList<TableToken>(TOKENS_KEY);
  const now = new Date().toISOString();
  const updated = all.map((t) =>
    t.tableId === tableId && !t.revokedAt ? { ...t, revokedAt: now } : t
  );
  const created: TableToken = { token: randomToken(), tableId, createdAt: now };
  writeList(TOKENS_KEY, [...updated, created]);
  return created;
}

/** The URL that goes on the sticker. */
export function orderUrlFor(token: string, origin: string): string {
  return `${publicOrigin(origin).replace(/\/$/, "")}/order/${token}`;
}

/**
 * The origin a printed QR code should point at.
 *
 * Stickers get printed once and live on the tables for months, so the origin
 * baked into them has to be the one a guest's phone can actually reach. The
 * page's own origin is the wrong default in the one case that matters: a
 * manager previewing on a dev server would print fourteen codes pointing at
 * localhost, and nothing would look wrong until a guest scanned one.
 *
 * NEXT_PUBLIC_APP_URL wins when set. Otherwise the current origin is used,
 * and isPrintableOrigin below is what stops a bad print run.
 */
export function publicOrigin(currentOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? configured : currentOrigin;
}

/** Whether a QR built from this origin is safe to print. */
export function isPrintableOrigin(currentOrigin: string): boolean {
  const origin = publicOrigin(currentOrigin);
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|$|\/)/i.test(origin);
}

export { newId };
