import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/admin/orgAuth";

export const runtime = "nodejs";

/**
 * A restaurant managing its own people — the route that retires the platform
 * from being every customer's IT department.
 *
 * Managers see the team; only owners change it. Emails come from the auth
 * admin API because they live in auth.users, which nothing client-side may
 * read — the list a manager sees is exactly their own organization's.
 */

export async function GET(request: Request) {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  const gate = await requireOrgRole(request, { branchId: branch }, ["owner", "manager"]);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const { data: members } = await gate.client
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("org_id", gate.orgId)
    .order("created_at");

  const rows = [];
  for (const m of (members ?? []) as { user_id: string; role: string }[]) {
    const { data } = await gate.client.auth.admin.getUserById(m.user_id);
    rows.push({
      userId: m.user_id,
      role: m.role,
      email: data?.user?.email ?? "(unknown)",
      you: m.user_id === gate.userId,
    });
  }
  return NextResponse.json({ orgId: gate.orgId, members: rows, yourRole: gate.role });
}

export async function POST(request: Request) {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  const gate = await requireOrgRole(request, { branchId: branch }, ["owner"]);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as { email?: string; password?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "staff";
  if (!email || (body.password ?? "").length < 8 || !["owner", "manager", "staff"].includes(role)) {
    return NextResponse.json(
      { error: "need email, password (8+), role owner|manager|staff" },
      { status: 400 }
    );
  }

  const { data: created, error: userError } = await gate.client.auth.admin.createUser({
    email,
    password: body.password!,
    email_confirm: true,
  });
  if (userError || !created?.user) {
    return NextResponse.json(
      { error: userError?.message ?? "could not create the login" },
      { status: 400 }
    );
  }

  const { error } = await gate.client
    .from("org_members")
    .insert({ org_id: gate.orgId, user_id: created.user.id, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ userId: created.user.id });
}

export async function PATCH(request: Request) {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  const gate = await requireOrgRole(request, { branchId: branch }, ["owner"]);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as { userId?: string; role?: string };
  if (!body.userId || !["owner", "manager", "staff"].includes(body.role ?? "")) {
    return NextResponse.json({ error: "need userId and a valid role" }, { status: 400 });
  }

  // Demoting the last owner locks the organization out of itself — the one
  // state no support call can undo from inside the product.
  if (body.role !== "owner") {
    const { data: owners } = await gate.client
      .from("org_members")
      .select("user_id")
      .eq("org_id", gate.orgId)
      .eq("role", "owner");
    const list = (owners ?? []) as { user_id: string }[];
    if (list.length === 1 && list[0].user_id === body.userId) {
      return NextResponse.json({ error: "cannot demote the last owner" }, { status: 400 });
    }
  }

  const { error } = await gate.client
    .from("org_members")
    .update({ role: body.role })
    .eq("org_id", gate.orgId)
    .eq("user_id", body.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const requestUrl = new URL(request.url);
  const branch = requestUrl.searchParams.get("branch") ?? "";
  const userId = requestUrl.searchParams.get("userId") ?? "";
  const gate = await requireOrgRole(request, { branchId: branch }, ["owner"]);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });
  if (!userId) return NextResponse.json({ error: "need userId" }, { status: 400 });

  const { data: owners } = await gate.client
    .from("org_members")
    .select("user_id")
    .eq("org_id", gate.orgId)
    .eq("role", "owner");
  const list = (owners ?? []) as { user_id: string }[];
  if (list.length === 1 && list[0].user_id === userId) {
    return NextResponse.json({ error: "cannot remove the last owner" }, { status: 400 });
  }

  // Membership goes; the login itself stays. Deleting an auth user destroys
  // the audit trail on everything they ever signed — removal from the org is
  // the operation a restaurant actually means.
  const { error } = await gate.client
    .from("org_members")
    .delete()
    .eq("org_id", gate.orgId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
