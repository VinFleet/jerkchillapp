import { supabase } from "@/lib/supabase/client";
import { getActiveTenant, setActiveTenant } from "@/lib/storage";

/**
 * The organization's branches — the SaaS spine.
 *
 * Everything else in the app is per-branch and doesn't know it: repos
 * namespace by the active tenant, sync scopes by it, RLS fences it. This is
 * the one module that looks across branches, and all it does is list them,
 * create them, and point the device at one.
 */

export type Branch = { id: string; org_id: string; name: string };
export type Organization = { id: string; name: string };

export async function getMyOrganization(): Promise<Organization | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("organizations").select("id, name").limit(1).maybeSingle();
  return (data as Organization | null) ?? null;
}

export async function getMyBranches(): Promise<Branch[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("branches").select("id, org_id, name").order("created_at");
  return (data as Branch[] | null) ?? [];
}

/**
 * A new branch: one row, then the device can switch to it.
 *
 * The branch starts empty on purpose. Its local store seeds itself the first
 * time a device opens it — the same first-run every new install gets — and
 * from there its menu, floor plan and settings are its own. Copying another
 * branch's data is a decision for a person, not a default.
 */
export async function createBranch(
  orgId: string,
  name: string
): Promise<{ ok: true; branch: Branch } | { ok: false; detail: string }> {
  if (!supabase) return { ok: false, detail: "offline" };
  const slug = `${orgId}-${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`.slice(0, 60);

  const { data, error } = await supabase
    .from("branches")
    .insert({ id: slug, org_id: orgId, name: name.trim() })
    .select("id, org_id, name")
    .single();
  if (error) return { ok: false, detail: error.message };
  return { ok: true, branch: data as Branch };
}

/** Point this device at a branch and start again from its data. */
export function switchBranch(branchId: string) {
  if (branchId === getActiveTenant()) return;
  setActiveTenant(branchId);
  // A full reload rather than router navigation, deliberately: every repo,
  // the sync engine and every open screen assume one tenant for their whole
  // life, and pretending otherwise is how cross-branch data bleeds.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/home";
}
