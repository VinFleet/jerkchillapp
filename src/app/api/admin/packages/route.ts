import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

/** Reprice a tier. A price change is a console action, never a deploy. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as { id?: string; pricePerBranchVnd?: number };
  const price = Math.round(Number(body.pricePerBranchVnd ?? -1));
  if (!body.id || price < 0) {
    return NextResponse.json({ error: "need id and pricePerBranchVnd >= 0" }, { status: 400 });
  }
  const { error } = await gate.client
    .from("support_packages")
    .update({ price_per_branch_vnd: price })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
