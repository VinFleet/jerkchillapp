import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isPushCategory, DEFAULT_PUSH_CATEGORIES } from "@/lib/push/categories";

/**
 * Registering and deregistering a device for alerts.
 *
 * Goes through the server rather than straight to Supabase from the browser so
 * that the categories can be validated once, in one place — an unknown value in
 * that array would silently mean "never notified about anything".
 */

export const runtime = "nodejs";

const LEGACY_TENANT = "jerk-and-chill-thao-dien";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type SubscribeBody = {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  staffId?: string | null;
  staffName?: string | null;
  categories?: string[];
  /** Which branch this device belongs to. Older clients omit it. */
  tenantId?: string;
  renewedFrom?: string;
};

export async function POST(request: Request) {
  const client = db();
  if (!client) {
    return NextResponse.json({ status: "skipped", reason: "not_configured" });
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Body was not JSON" }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Incomplete push subscription" }, { status: 400 });
  }

  // Drop anything we don't recognise rather than storing it. An empty result
  // falls back to the defaults, so a device is never left silently subscribed
  // to nothing at all.
  const requested = (body.categories ?? []).filter(isPushCategory);
  const categories = requested.length > 0 ? requested : DEFAULT_PUSH_CATEGORIES;

  // A renewed subscription replaces the old endpoint rather than adding a
  // second row for the same phone.
  if (body.renewedFrom && body.renewedFrom !== endpoint) {
    await client
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", body.renewedFrom)
      .then(
        () => undefined,
        () => undefined
      );
  }

  const { error } = await client.from("push_subscriptions").upsert(
    {
      endpoint,
      tenant_id: (body.tenantId?.trim() || LEGACY_TENANT),
      staff_id: body.staffId ?? null,
      staff_name: body.staffName ?? null,
      p256dh,
      auth,
      categories,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "subscribed", categories });
}

export async function DELETE(request: Request) {
  const client = db();
  if (!client) return NextResponse.json({ status: "skipped" });

  let endpoint: string | undefined;
  try {
    endpoint = ((await request.json()) as { endpoint?: string }).endpoint;
  } catch {
    return NextResponse.json({ error: "Body was not JSON" }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "unsubscribed" });
}
