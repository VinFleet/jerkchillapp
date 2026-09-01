import { NextResponse } from "next/server";
import { requireAdmin, slugify } from "@/lib/admin/auth";

export const runtime = "nodejs";

/** Everything the platform runs, in one read. */
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const { data: orgs } = await gate.client
    .from("organizations")
    .select("id, name, active, created_at")
    .order("created_at");
  const { data: branches } = await gate.client
    .from("branches")
    .select("id, org_id, name")
    .order("created_at");
  const { data: members } = await gate.client
    .from("org_members")
    .select("org_id, user_id, role");
  const { data: billing } = await gate.client
    .from("org_billing")
    .select("org_id, setup_paid_at, support_until, package_id");
  const { data: packages } = await gate.client
    .from("support_packages")
    .select("id, name, price_per_branch_vnd, sort")
    .order("sort");

  return NextResponse.json({
    orgs: orgs ?? [],
    branches: branches ?? [],
    members: members ?? [],
    billing: billing ?? [],
    packages: packages ?? [],
  });
}

type CreateBody = {
  name?: string;
  branchName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
};

/**
 * A new restaurant, ready to hand over: the org, its first branch, and the
 * owner's login. One call, because half a restaurant is not a deliverable.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }
  const name = body.name?.trim();
  const branchName = body.branchName?.trim();
  const email = body.ownerEmail?.trim().toLowerCase();
  const password = body.ownerPassword ?? "";
  if (!name || !branchName || !email || password.length < 8) {
    return NextResponse.json(
      { error: "need name, branchName, ownerEmail, ownerPassword (8+ chars)" },
      { status: 400 }
    );
  }

  const orgSlug = slugify(name);
  const branchSlug = `${orgSlug}-${slugify(branchName)}`.slice(0, 60);

  // The owner's login first: if the email is already taken, nothing else has
  // happened yet and the error is clean.
  const { data: created, error: userError } = await gate.client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !created?.user) {
    return NextResponse.json({ error: userError?.message ?? "could not create user" }, { status: 400 });
  }

  const { error: orgError } = await gate.client.from("organizations").insert({ id: orgSlug, name });
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 400 });

  const { error: branchError } = await gate.client
    .from("branches")
    .insert({ id: branchSlug, org_id: orgSlug, name: branchName });
  if (branchError) return NextResponse.json({ error: branchError.message }, { status: 400 });

  const { error: memberError } = await gate.client
    .from("org_members")
    .insert({ org_id: orgSlug, user_id: created.user.id, role: "owner" });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });

  return NextResponse.json({ orgId: orgSlug, branchId: branchSlug, ownerUserId: created.user.id });
}

/** Suspend or restore an organization. Data stays; access stops. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as { orgId?: string; active?: boolean };
  if (!body.orgId || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "need orgId and active" }, { status: 400 });
  }
  const { error } = await gate.client
    .from("organizations")
    .update({ active: body.active })
    .eq("id", body.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
