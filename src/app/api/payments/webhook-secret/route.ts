import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireOrgRole } from "@/lib/admin/orgAuth";

export const runtime = "nodejs";

/**
 * The owner's tap that arms transfer confirmation for their branch.
 *
 * POST rotates: a fresh secret is stored and returned ONCE, with the webhook
 * URL to paste into the provider. It is not readable back — a secret that
 * can be re-read from a screen is a secret on every screenshot. GET says
 * only whether one is set.
 *
 * Allowed for owners and managers of the organization that owns the branch,
 * proven from their session token — not from anything the client claims.
 */
export async function GET(request: Request) {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  const gate = await requireOrgRole(request, { branchId: branch }, ["owner", "manager"]);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });
  const client = gate.client;

  const { data } = await client
    .from("branch_secrets")
    .select("updated_at")
    .eq("tenant_id", branch)
    .maybeSingle();
  return NextResponse.json({
    configured: Boolean(data),
    updatedAt: (data as { updated_at?: string } | null)?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  const gate = await requireOrgRole(request, { branchId: branch }, ["owner", "manager"]);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });
  const client = gate.client;

  const secret = randomBytes(32).toString("hex");
  const { error } = await client
    .from("branch_secrets")
    .upsert({ tenant_id: branch, webhook_secret: secret, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    secret,
    webhookUrl: `${origin}/api/payments/webhook?branch=${encodeURIComponent(branch)}`,
    note: "Shown once. Paste both into the payment provider now.",
  });
}
