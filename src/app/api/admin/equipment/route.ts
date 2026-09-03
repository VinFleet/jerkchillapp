import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * The platform's side of "we didn't have your fridge in the catalog".
 *
 * GET returns the catalog and the suggestion queue together — the admin
 * screen's whole job here is deciding, for each pending suggestion, whether
 * it becomes reference data for every future customer.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const { data: catalog } = await gate.client
    .from("equipment_catalog")
    .select("id, category, brand, model, capacity_liters, target_min_c, target_max_c, notes, active")
    .order("brand");

  const { data: suggestions } = await gate.client
    .from("equipment_suggestions")
    .select("id, tenant_id, category, brand, model, capacity_liters, note, submitted_by, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ catalog: catalog ?? [], suggestions: suggestions ?? [] });
}

type AddBody = {
  id?: string;
  category?: string;
  brand?: string;
  model?: string;
  capacityLiters?: number | null;
  targetMinC?: number;
  targetMaxC?: number;
  notes?: string;
  /** The suggestion this came from, so it can be marked handled in one call. */
  fromSuggestionId?: string;
};

/** Fold a suggestion (or a fresh entry) into the shared catalog. */
export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  let body: AddBody;
  try {
    body = (await request.json()) as AddBody;
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const category = body.category;
  const brand = body.brand?.trim();
  const model = body.model?.trim();
  if (
    !brand ||
    !model ||
    (category !== "fridge" && category !== "freezer" && category !== "combo") ||
    !Number.isFinite(body.targetMinC) ||
    !Number.isFinite(body.targetMaxC)
  ) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }

  const id =
    body.id?.trim() ||
    `${brand}-${model}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const { error } = await gate.client.from("equipment_catalog").upsert({
    id,
    category,
    brand,
    model,
    capacity_liters: body.capacityLiters ?? null,
    target_min_c: body.targetMinC,
    target_max_c: body.targetMaxC,
    notes: body.notes?.trim() || null,
    active: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.fromSuggestionId) {
    await gate.client
      .from("equipment_suggestions")
      .update({ status: "added", reviewed_at: new Date().toISOString() })
      .eq("id", body.fromSuggestionId);
  }

  return NextResponse.json({ status: "added", id });
}

/** Dismiss a suggestion without adding it — a one-off fridge nobody else has. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: "no" }, { status: gate.status });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "incomplete" }, { status: 400 });

  const { error } = await gate.client
    .from("equipment_suggestions")
    .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "dismissed" });
}
