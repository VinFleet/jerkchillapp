import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyIpn, isPaidStatus } from "@/lib/payments/ninepay";

/**
 * Where the card terminal says the payment landed.
 *
 * Deliberately the same shape as the bank-transfer webhook next door: this
 * records what arrived in payment_webhook_events and settles nothing itself.
 * The till holds its orders in local storage, so it asks ../status whether
 * its own reference has been seen and confirms into its own store, which
 * keeps money on the same local-first path as everything else.
 *
 * 9Pay sends the IPN as form-encoded `result` + `checksum` + `version`, and
 * only for successful transactions — but the decoded status is checked
 * anyway rather than trusted, because "they only send success" is a promise
 * about their code, and this endpoint closes bills.
 */

export const runtime = "nodejs";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("branch")?.trim();
  if (!tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await request.text();
  // Form-encoded per 9Pay's spec, but a JSON body is accepted too: providers
  // change transport more often than they change payloads, and the checksum
  // is what actually authenticates this, not the encoding.
  let result: string | null = null;
  let checksum: string | null = null;
  try {
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as { result?: string; checksum?: string };
      result = parsed.result ?? null;
      checksum = parsed.checksum ?? null;
    } else {
      const form = new URLSearchParams(raw);
      result = form.get("result");
      checksum = form.get("checksum");
    }
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = db();
  if (!client) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data } = await client
    .from("branch_secrets")
    .select("ninepay_checksum_key")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const checksumKey = (data as { ninepay_checksum_key?: string } | null)?.ninepay_checksum_key;

  const verdict = verifyIpn(checksumKey, result, checksum);
  if (!verdict.ok) {
    // Uniform on purpose: an unknown branch, an unset key and a forged
    // checksum are indistinguishable from outside.
    console.warn(`[9pay] ipn rejected: ${verdict.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const fields = verdict.data as {
    request_id?: string;
    payment_no?: string;
    amount?: number | string;
    status?: number | string;
    failure_reason?: string;
  };

  const providerRef = String(fields.payment_no ?? "").trim();
  const reference = String(fields.request_id ?? "").trim() || null;
  const amountVnd = Math.round(Number(fields.amount ?? 0));
  const status = Number(fields.status ?? 0);

  if (!providerRef || !Number.isFinite(amountVnd) || amountVnd <= 0) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }

  // A failed or cancelled card is recorded but must never settle a bill, so
  // it is stored with no reference for anyone to match against.
  const settles = isPaidStatus(status);

  const { error } = await client.from("payment_webhook_events").insert({
    tenant_id: tenantId,
    provider: "9pay",
    provider_ref: providerRef,
    reference: settles ? reference : null,
    amount_vnd: amountVnd,
    payload: verdict.data,
    matched: false,
  });

  if (error) {
    // The unique (provider, provider_ref) constraint doing its job: 9Pay
    // retried, and a retry must not settle a bill twice.
    if (error.code === "23505") return NextResponse.json({ status: "already_recorded" });
    console.error(`[9pay] could not record ipn: ${error.message}`);
    return NextResponse.json({ error: "write_failed" }, { status: 503 });
  }

  if (!settles) {
    console.warn(`[9pay] card not paid (status ${status}) ref ${reference}: ${fields.failure_reason ?? ""}`);
  }

  return NextResponse.json({ status: "recorded", settles });
}
