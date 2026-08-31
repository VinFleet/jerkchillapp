import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * "Has this transfer landed yet?"
 *
 * The till asks about its own pending reference while the guest is still
 * standing there. It returns only the amount and whether it matched — enough
 * for the device to confirm the payment in its own store, and nothing that
 * would let someone enumerate the evening's takings by guessing references.
 *
 * A reference is not a secret, but it is unguessable enough (six characters of
 * the order id plus a sequence) that this is not a useful oracle. It is also
 * read-only: nothing here settles anything.
 */

export const runtime = "nodejs";

const TENANT_ID = "jerk-and-chill-thao-dien";

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference");

  // Shaped like ours or not at all — this refuses to be a general query
  // interface over the payments table.
  if (!reference || !/^JC[A-Z0-9]{6,10}$/.test(reference)) {
    return NextResponse.json({ error: "bad_reference" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ status: "unknown", reason: "not_configured" });
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client
    .from("payment_webhook_events")
    .select("provider, provider_ref, amount_vnd, received_at")
    .eq("tenant_id", TENANT_ID)
    .eq("reference", reference)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // "Not yet" and "we could not look" must be distinguishable, or the till
    // will wait forever on an outage believing the guest has not paid.
    return NextResponse.json({ status: "unknown", reason: "lookup_failed" }, { status: 503 });
  }

  if (!data) return NextResponse.json({ status: "pending" });

  return NextResponse.json({
    status: "paid",
    provider: data.provider,
    providerRef: data.provider_ref,
    amountVnd: data.amount_vnd,
    receivedAt: data.received_at,
  });
}
