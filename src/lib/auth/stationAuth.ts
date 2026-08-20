import { supabase } from "@/lib/supabase/client";

/**
 * Station sign-in is a *device* setup step, not a shift routine.
 *
 * Every synced table is behind `auth.role() = 'authenticated'`, so a tablet
 * with no Supabase session syncs nothing — it would look like it was working
 * while quietly keeping every checklist tick and temperature reading to
 * itself. So the kitchen and bar tablets do hold a real login; it is just
 * entered once, by the manager, when the device is set up, and then never
 * again. Staff picking their name from the dropdown is unaffected.
 */
export async function deviceIsSignedIn(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export type ManagerCheck =
  | { ok: true }
  | { ok: false; reason: "not-signed-in" }
  | { ok: false; reason: "not-a-manager" }
  | { ok: false; reason: "no-role-row"; userId: string }
  | { ok: false; reason: "table-missing" };

/**
 * Whether the account this device is signed in as may run the manager station.
 *
 * This is the difference between a shared tablet and the owner's phone. Before
 * stations existed, the app decided this from a value in localStorage, which
 * meant anyone could tap "Manager", type a name, and see wages and cost
 * margins. The answer now comes from `staff_roles` in the database, which the
 * app cannot write to — roles are assigned by hand in the Supabase dashboard,
 * so a device cannot promote itself.
 *
 * Deliberately fails closed: an account with no role row is refused rather
 * than waved through, and the caller shows the exact SQL to fix it.
 */
export async function checkManagerAccess(): Promise<ManagerCheck> {
  if (!supabase) return { ok: false, reason: "not-signed-in" };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, reason: "not-signed-in" };

  const { data, error } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  // `staff_roles` lives in schema.sql, not sync-schema.sql, so a project set up
  // for sync alone won't have it. That's a different problem from "this person
  // has no role" and needs a different instruction, so don't collapse the two.
  if (error) return { ok: false, reason: "table-missing" };
  // RLS lets a person read only their own row, so an empty result means this
  // account has not been granted a role — not that it was denied one.
  if (!data) return { ok: false, reason: "no-role-row", userId };
  if (data.role === "owner" || data.role === "manager") return { ok: true };
  return { ok: false, reason: "not-a-manager" };
}
