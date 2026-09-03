import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/admin/orgAuth";
import { buildAuthorizationHeader, toRequestId, type NinePayMethod } from "@/lib/payments/ninepay";

/**
 * Push a charge to the restaurant's 9Pay card terminal.
 *
 * This exists server-side and nowhere else because the signing key can
 * create charges in the restaurant's name. It never reaches a device, never
 * syncs, and is read here with the service role.
 *
 * requireOrgRole is the whole reason this is safe to expose: without it,
 * `branch` came straight off the request body, and anyone on the internet
 * who could name or guess a branch id could push a real charge to that
 * restaurant's card terminal. Owner/manager only — the one station type
 * that actually holds a Supabase login (rule 8: stations, not personal
 * logins). A bartender station can still take a card payment the manual
 * way (type the slip reference); it just cannot self-authorize the
 * one-tap terminal push, the same way it cannot self-authorize a refund.
 *
 * Nothing is settled here. The terminal takes the card, 9Pay POSTs the IPN
 * to ../ipn, and the till's existing pending-payment poll — the one built
 * for bank transfers — sees its own reference come back and confirms into
 * local storage. One settlement path for every non-cash method.
 */

export const runtime = "nodejs";

const CREATE_URI = "/pos/merchant/create-transaction";
const DEFAULT_ENDPOINT = "https://sand-api.9pay.vn";

type Body = {
  branch?: string;
  reference?: string;
  amountVnd?: number;
  method?: NinePayMethod;
  description?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const tenantId = (body.branch ?? "").trim();
  const reference = (body.reference ?? "").trim();
  const amountVnd = Math.round(Number(body.amountVnd ?? 0));
  const method: NinePayMethod = body.method === "QR" ? "QR" : "CARD";

  if (!tenantId || !reference || !Number.isFinite(amountVnd) || amountVnd <= 0) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }

  const gate = await requireOrgRole(request, { branchId: tenantId }, ["owner", "manager"]);
  if (!gate.ok) return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  const client = gate.client;

  const { data } = await client
    .from("branch_secrets")
    .select("ninepay_merchant_key, ninepay_secret_key, ninepay_serial, ninepay_endpoint")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const creds = data as {
    ninepay_merchant_key?: string;
    ninepay_secret_key?: string;
    ninepay_serial?: string;
    ninepay_endpoint?: string;
  } | null;

  if (!creds?.ninepay_merchant_key || !creds.ninepay_secret_key || !creds.ninepay_serial) {
    // Said plainly, because unlike the webhook this is not an endpoint a
    // stranger probes — it is staff being told their terminal is not set up.
    return NextResponse.json({ error: "ninepay_not_set_up" }, { status: 409 });
  }

  const endpoint = (creds.ninepay_endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const timestamp = Math.floor(Date.now() / 1000);

  const params = {
    request_id: toRequestId(reference),
    currency: "VND",
    amount: amountVnd,
    method,
    serial_number: creds.ninepay_serial,
    return_url: `${new URL(request.url).origin}/api/payments/ninepay/ipn?branch=${encodeURIComponent(tenantId)}`,
    description: body.description?.slice(0, 120),
  };

  const authorization = buildAuthorizationHeader({
    merchantKey: creds.ninepay_merchant_key,
    secretKey: creds.ninepay_secret_key,
    method: "POST",
    uri: CREATE_URI,
    timestamp,
    params,
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${endpoint}${CREATE_URI}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        Date: String(timestamp),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      // The waiter is standing at the table with a card in hand; a request
      // that hangs is worse than one that fails and lets them take cash.
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }

  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 500) };
  }

  if (!upstream.ok) {
    console.warn(`[9pay] create-transaction ${upstream.status}: ${text.slice(0, 300)}`);
    return NextResponse.json({ error: "rejected", status: upstream.status, payload }, { status: 502 });
  }

  return NextResponse.json({ status: "sent_to_terminal", payload });
}
