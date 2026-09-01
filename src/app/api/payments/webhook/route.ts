import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook } from "@/lib/payments/webhookAuth";

/**
 * Where a bank transfer tells us it landed.
 *
 * The device that raised the QR is not necessarily the device that hears about
 * the payment — the guest transfers, the bank tells the provider, the provider
 * tells this endpoint, and the till is a tablet holding its orders in local
 * storage. So this does not try to settle the bill itself. It records what
 * arrived, and the till asks (see ../status) whether its own pending reference
 * has been seen. The device confirms into its own store and that syncs out,
 * which keeps the local-first rule intact for money as well as everything else.
 *
 * Replays are expected, not exceptional: every one of these providers retries
 * on a non-200, and a duplicate must not settle a bill twice. The unique
 * constraint on (provider, provider_ref) is what makes that safe, so a
 * conflict is a success here rather than an error.
 */

export const runtime = "nodejs";

// Which branch this callback is for comes from the URL the provider was
// given — each branch pastes its own webhook URL, and the secret that URL is
// verified against lives in branch_secrets for that tenant. The original
// restaurant predates all of this, so a call with no branch parameter falls
// back to it and to the env secret it has always used.
const LEGACY_TENANT = "jerk-and-chill-thao-dien";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * The reference as the bank actually returns it.
 *
 * Banking apps wrap our reference in whatever the payer typed and their own
 * boilerplate, so the memo comes back as something like
 * "CHUYEN TIEN JCA1B2C41 GD 123456". Ours is the recognisable island in that.
 */
function extractReference(memo: string): string | null {
  const m = /JC[A-Z0-9]{6,10}/.exec(memo.toUpperCase());
  return m ? m[0] : null;
}

type WebhookBody = {
  id?: string | number;
  transferAmount?: number;
  amount?: number;
  content?: string;
  description?: string;
  referenceCode?: string;
};

export async function POST(request: Request) {
  // Read the body as text, not JSON: the signature covers the bytes the
  // provider sent. Parsing and re-serialising changes key order and
  // whitespace, and the signature would never match again.
  const raw = await request.text();

  const tenantId = new URL(request.url).searchParams.get("branch") ?? LEGACY_TENANT;

  // The branch's own secret, or the env secret for the legacy tenant. Looked
  // up BEFORE verification so a wrong branch id fails exactly like a wrong
  // signature — uniformly, telling a prober nothing.
  let secret = tenantId === LEGACY_TENANT ? process.env.PAYMENT_WEBHOOK_SECRET : undefined;
  {
    const lookup = db();
    if (lookup) {
      const { data } = await lookup
        .from("branch_secrets")
        .select("webhook_secret")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const stored = (data as { webhook_secret?: string } | null)?.webhook_secret;
      if (stored) secret = stored;
    }
  }

  const verdict = verifyWebhook(
    secret,
    raw,
    request.headers.get("x-signature") ??
      request.headers.get("x-sepay-signature") ??
      request.headers.get("authorization")
  );

  if (!verdict.ok) {
    // Deliberately uniform: an attacker probing this endpoint should not learn
    // whether the secret is unset, the header is missing or the value is wrong.
    console.warn(`[payments] webhook rejected: ${verdict.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const client = db();
  if (!client) {
    // 503 rather than 200: the provider should retry, because this transfer is
    // real money we have simply failed to write down.
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const provider = new URL(request.url).searchParams.get("provider") ?? "sepay";
  const providerRef = String(body.id ?? body.referenceCode ?? "").trim();
  const amountVnd = Math.round(Number(body.transferAmount ?? body.amount ?? 0));
  const memo = String(body.content ?? body.description ?? "");
  const reference = extractReference(memo);

  if (!providerRef || !Number.isFinite(amountVnd) || amountVnd <= 0) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }

  const { error } = await client.from("payment_webhook_events").insert({
    tenant_id: tenantId,
    provider,
    provider_ref: providerRef,
    reference,
    amount_vnd: amountVnd,
    payload: body,
    matched: false,
  });

  if (error) {
    // 23505 is the unique violation — this exact event has already been
    // recorded. That is a retry doing its job, so it is a 200.
    if (error.code === "23505") {
      return NextResponse.json({ status: "already_recorded" });
    }
    console.error(`[payments] could not record webhook: ${error.message}`);
    return NextResponse.json({ error: "write_failed" }, { status: 503 });
  }

  if (!reference) {
    // Money with no reference we recognise. Someone transferred with a
    // mistyped memo and is very likely standing at the till right now, so this
    // is loud rather than silent.
    console.warn(`[payments] unmatched transfer ${amountVnd}đ, memo: ${memo.slice(0, 120)}`);
  }

  return NextResponse.json({ status: "recorded", matched: Boolean(reference) });
}
