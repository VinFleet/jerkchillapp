import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MenuItem, Order, OrderLine, OrderLineChoice } from "@/lib/types";
import type { TableToken } from "@/lib/repo/tableTokens";
import { newId } from "@/lib/storage";
import { linePriceVnd } from "@/lib/repo/orderRules";
import { sendPush } from "@/lib/push/server";

/**
 * The guest's half of QR ordering.
 *
 * A guest's phone is a stranger's browser: it has no local store of ours, no
 * Supabase session, and no way to sync. So everything the ordering page needs
 * — which table this is, what the menu says today, and somewhere to put the
 * order — has to come through here.
 *
 * Writes go into `synced_records` in exactly the shape a device would have
 * written locally, so the till pulls a guest's order down through the same
 * merge path as a waiter's. No second ingestion route, no separate table, and
 * no shape that only the server knows how to produce.
 *
 * Service role, because the guest must never hold a key that can read the
 * menu, the tokens, or anybody's orders directly.
 */

export const runtime = "nodejs";

const TENANT_ID = "jerk-and-chill-thao-dien";

/** A guest cannot order fifty of anything by accident, or on purpose. */
const MAX_QTY_PER_LINE = 20;
const MAX_LINES = 40;
const MAX_NOTE_LENGTH = 200;

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readCollection<T>(client: SupabaseClient, collection: string): Promise<T[]> {
  const { data, error } = await client
    .from("synced_records")
    .select("data")
    .eq("tenant_id", TENANT_ID)
    .eq("collection", collection)
    .eq("deleted", false);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => (row as { data: T }).data);
}

/**
 * Which table a QR belongs to.
 *
 * Returns null for unknown and for revoked alike. A sticker that was replaced
 * must stop working — that is the whole point of rotating it — and the caller
 * tells a guest the same vague thing either way.
 */
async function resolveTable(client: SupabaseClient, token: string): Promise<string | null> {
  const tokens = await readCollection<TableToken>(client, "table_tokens");
  const match = tokens.find((t) => t.token === token && !t.revokedAt);
  return match?.tableId ?? null;
}

/** GET — what this table can order. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Shape-check first, so a scanner probing the route costs us nothing and
  // learns nothing — a malformed token is "no such table" whether or not the
  // backend behind this is even configured.
  if (!/^[A-Z0-9]{6,16}$/.test(token)) {
    return NextResponse.json({ error: "unknown_table" }, { status: 404 });
  }

  const client = db();
  if (!client) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  try {
    const tableId = await resolveTable(client, token);
    if (!tableId) return NextResponse.json({ error: "unknown_table" }, { status: 404 });

    const menu = await readCollection<MenuItem>(client, "menu_items");
    return NextResponse.json({
      // Only what the page renders. Cost, margin and the delivery price list
      // are none of a guest's business.
      menu: menu
        .filter((m) => m.active && m.pricesVnd?.dine_in != null)
        .map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          priceVnd: m.pricesVnd.dine_in,
          // Public by design — the same photo the printed menu uses.
          imageUrl: m.imageUrl,
          // The questions the waiter would ask — spice level, mocktail. The
          // guest answers them on their own phone instead.
          options: m.options,
        })),
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

type PlaceBody = {
  lines?: {
    menuItemId?: string;
    qty?: number;
    /** Ids only. The server resolves labels and price deltas from the menu —
     *  anything a guest can send is something a guest can forge. */
    choices?: { optionId?: string; choiceId?: string }[];
  }[];
  note?: string;
};

/** POST — place the order. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!/^[A-Z0-9]{6,16}$/.test(token)) {
    return NextResponse.json({ error: "unknown_table" }, { status: 404 });
  }

  const client = db();
  if (!client) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let body: PlaceBody;
  try {
    body = (await request.json()) as PlaceBody;
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const requested = Array.isArray(body.lines) ? body.lines.slice(0, MAX_LINES) : [];
  if (requested.length === 0) {
    return NextResponse.json({ error: "empty_order" }, { status: 400 });
  }

  try {
    const tableId = await resolveTable(client, token);
    if (!tableId) return NextResponse.json({ error: "unknown_table" }, { status: 404 });

    const menu = await readCollection<MenuItem>(client, "menu_items");

    // Price from the menu, never from the request. A posted price is a guest
    // naming their own — the client sends an id and a quantity, nothing more.
    const lines: OrderLine[] = [];
    for (const line of requested) {
      const item = menu.find((m) => m.id === line.menuItemId && m.active);
      const price = item?.pricesVnd?.dine_in;
      if (!item || price == null) continue;

      // Resolve the guest's answers against the menu's own options. The
      // client sends ids; the label and the price delta come from here, so a
      // forged delta is simply ignored. An unanswered REQUIRED question
      // refuses the line — the kitchen cooking the default and finding out at
      // the table is the exact failure the question exists to prevent.
      const chosen: OrderLineChoice[] = [];
      let missingRequired = false;
      for (const option of item.options ?? []) {
        const pick = (line.choices ?? []).find((c) => c.optionId === option.id);
        const choice = option.choices.find((c) => c.id === pick?.choiceId);
        if (choice) {
          chosen.push({
            optionId: option.id,
            choiceId: choice.id,
            label: choice.label,
            priceDeltaVnd: choice.priceDeltaVnd,
          });
        } else if (option.required) {
          missingRequired = true;
        }
      }
      if (missingRequired) continue;

      const qty = Math.min(MAX_QTY_PER_LINE, Math.max(1, Math.round(Number(line.qty) || 1)));
      lines.push({
        id: newId("line"),
        menuItemId: item.id,
        unitPriceVnd: linePriceVnd(price, chosen),
        qty,
        status: "placed",
        choices: chosen.length ? chosen : undefined,
        // A guest has no "send" button — tapping order IS sending. Without
        // this the ticket would sit unsent on the pass forever, waiting for
        // a waiter who was never involved.
        sentAt: new Date().toISOString(),
      });
    }

    if (lines.length === 0) {
      // Everything they asked for is off the menu or unpriced. Better a clear
      // refusal than an empty order appearing on the pass.
      return NextResponse.json({ error: "nothing_orderable" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const order: Order = {
      id: newId("order"),
      tableId,
      source: "qr",
      channel: "dine_in",
      status: "placed",
      lines,
      placedAt: now,
      // No name: a guest ordered this. That is what tells the pass and the
      // reports a QR order from a waiter's.
      placedBy: null,
      guestNote: typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, MAX_NOTE_LENGTH)
        : undefined,
      updatedAt: now,
    };

    const { error } = await client.from("synced_records").upsert(
      {
        tenant_id: TENANT_ID,
        collection: "orders",
        record_id: order.id,
        data: order,
        deleted: false,
      },
      { onConflict: "tenant_id,collection,record_id" }
    );

    if (error) {
      // The guest must not be told the order is on its way when it is not.
      return NextResponse.json({ error: "not_saved" }, { status: 503 });
    }

    // Tell the kitchen. A guest orders by QR and then simply waits — nobody is
    // standing at the pass announcing it, and sync only pulls once a minute, so
    // without this the first anyone knows is a guest asking where their food is.
    //
    // Deliberately not awaited and never allowed to throw: the order is saved
    // at this point, and a push failure must not turn a placed order into an
    // error the guest sees. The alert rides on the action that produced it,
    // which is the rule that keeps this app free of cron jobs.
    void sendPush({
      category: "orders",
      title: "New table order · Đơn mới tại bàn",
      body: `${lines.length} item${lines.length === 1 ? "" : "s"}${
        order.guestNote ? ` — note: ${order.guestNote}` : ""
      }`,
      url: "/kitchen",
      // One notification per order rather than a stack: a guest adding a
      // second round should not bury the first.
      tag: `order-${order.id}`,
      urgent: true,
    }).catch(() => undefined);

    return NextResponse.json({ status: "placed", orderId: order.id, lines: lines.length });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
