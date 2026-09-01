import { NextResponse } from "next/server";
import { requireAdmin, slugify } from "@/lib/admin/auth";

export const runtime = "nodejs";

/** A new location for an existing restaurant. */
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as { orgId?: string; name?: string };
  const name = body.name?.trim();
  if (!body.orgId || !name) {
    return NextResponse.json({ error: "need orgId and name" }, { status: 400 });
  }

  const branchSlug = `${body.orgId}-${slugify(name)}`.slice(0, 60);
  const { error } = await gate.client
    .from("branches")
    .insert({ id: branchSlug, org_id: body.orgId, name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ branchId: branchSlug });
}
