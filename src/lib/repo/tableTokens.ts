import { readList, writeList, newId } from "@/lib/storage";

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
  return `${origin.replace(/\/$/, "")}/order/${token}`;
}

export { newId };
