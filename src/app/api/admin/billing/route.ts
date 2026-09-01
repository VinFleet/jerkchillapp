import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

/**
 * Recording money that arrived — the platform's half of "pay by QR".
 *
 * The customer scans, the transfer lands in VINPOS's bank, and the admin
 * records it here against the organization: a setup fee flips setup_paid_at,
 * a support payment extends support_until by whole months from wherever the
 * clock currently stands (never shortening it — support bought is support
 * owed). The ledger keeps every payment as its own row, because the rollup
 * answers "are they covered" and only the ledger answers "since when, paid
 * how, matched to which memo".
 */
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json()) as {
    orgId?: string;
    kind?: string;
    amountVnd?: number;
    months?: number;
    reference?: string;
    packageId?: string;
  };
  const months = Math.round(Number(body.months ?? 0));
  if (
    !body.orgId ||
    !["setup", "support"].includes(body.kind ?? "") ||
    (body.kind === "support" && (months < 1 || !body.packageId))
  ) {
    return NextResponse.json(
      { error: "need orgId, kind setup|support; support needs packageId and months >= 1" },
      { status: 400 }
    );
  }

  // The list price: tier x branches x months. An explicit amount overrides it
  // — a negotiated deal is a business decision — but the computed figure is
  // what fills the form, so the default is the price list, not a guess.
  const { count: branchesCount } = await gate.client
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("org_id", body.orgId);
  let amount = Math.round(Number(body.amountVnd ?? 0));
  if (body.kind === "support" && amount <= 0) {
    const { data: pkg } = await gate.client
      .from("support_packages")
      .select("price_per_branch_vnd")
      .eq("id", body.packageId)
      .maybeSingle();
    const price = (pkg as { price_per_branch_vnd?: number } | null)?.price_per_branch_vnd ?? 0;
    amount = price * (branchesCount ?? 1) * months;
  }
  if (amount <= 0) return NextResponse.json({ error: "amount came to zero" }, { status: 400 });

  const { error: ledgerError } = await gate.client.from("platform_billing_payments").insert({
    org_id: body.orgId,
    kind: body.kind,
    amount_vnd: amount,
    months: body.kind === "support" ? months : 0,
    reference: body.reference?.trim() || null,
    recorded_by: gate.userId,
    package_id: body.kind === "support" ? body.packageId : null,
    branches_count: branchesCount ?? null,
  });
  if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 400 });

  const { data: current } = await gate.client
    .from("org_billing")
    .select("setup_paid_at, support_until")
    .eq("org_id", body.orgId)
    .maybeSingle();
  const row = current as { setup_paid_at?: string; support_until?: string } | null;

  const today = new Date().toISOString().slice(0, 10);
  let supportUntil = row?.support_until ?? null;
  if (body.kind === "support") {
    // Extend from whichever is later: today, or the existing expiry. Paying
    // early must never cost the customer the days they already own.
    const base = supportUntil && supportUntil > today ? new Date(supportUntil) : new Date();
    base.setMonth(base.getMonth() + months);
    supportUntil = base.toISOString().slice(0, 10);
  }

  const { data: existing } = await gate.client
    .from("org_billing")
    .select("package_id")
    .eq("org_id", body.orgId)
    .maybeSingle();
  const { error } = await gate.client.from("org_billing").upsert({
    org_id: body.orgId,
    setup_paid_at: body.kind === "setup" ? new Date().toISOString() : (row?.setup_paid_at ?? null),
    support_until: supportUntil,
    package_id:
      body.kind === "support"
        ? body.packageId
        : ((existing as { package_id?: string } | null)?.package_id ?? null),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, supportUntil, amountVnd: amount });
}
