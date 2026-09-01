import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

/** A login for someone at a restaurant, with their seat at the org. */
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as {
    orgId?: string;
    email?: string;
    password?: string;
    role?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "staff";
  if (!body.orgId || !email || (body.password ?? "").length < 8 || !["owner", "manager", "staff"].includes(role)) {
    return NextResponse.json(
      { error: "need orgId, email, password (8+), role owner|manager|staff" },
      { status: 400 }
    );
  }

  const { data: created, error: userError } = await gate.client.auth.admin.createUser({
    email,
    password: body.password!,
    email_confirm: true,
  });
  if (userError || !created?.user) {
    return NextResponse.json({ error: userError?.message ?? "could not create user" }, { status: 400 });
  }

  const { error } = await gate.client
    .from("org_members")
    .insert({ org_id: body.orgId, user_id: created.user.id, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ userId: created.user.id });
}
