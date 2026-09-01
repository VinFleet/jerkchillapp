import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
async function gate(request: Request, branch: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await client.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data: branchRow } = await client
    .from("branches")
    .select("org_id")
    .eq("id", branch)
    .maybeSingle();
  if (!branchRow) return null;

  const { data: membership } = await client
    .from("org_members")
    .select("role")
    .eq("org_id", (branchRow as { org_id: string }).org_id)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (membership as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "manager") return null;

  return client;
}

export async function GET(request: Request) {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  const client = await gate(request, branch);
  if (!client) return NextResponse.json({ error: "no" }, { status: 401 });

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
  const client = await gate(request, branch);
  if (!client) return NextResponse.json({ error: "no" }, { status: 401 });

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
