import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The gate for org-scoped server routes — a caller acting on their OWN
 * organization, as opposed to requireAdmin, which is the platform acting on
 * anyone's.
 *
 * Proof comes from the session token, never from what the client claims:
 * identify the user, find the org that owns the branch (or take the org id
 * directly), read their membership, compare against the roles the route
 * demands. Only then is the service client handed back.
 */
export async function requireOrgRole(
  request: Request,
  scope: { branchId?: string; orgId?: string },
  roles: ("owner" | "manager")[]
): Promise<
  | { ok: true; client: SupabaseClient; userId: string; orgId: string; role: string }
  | { ok: false; status: number }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 503 };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401 };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await client.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, status: 401 };

  let orgId = scope.orgId ?? null;
  if (!orgId && scope.branchId) {
    const { data } = await client
      .from("branches")
      .select("org_id")
      .eq("id", scope.branchId)
      .maybeSingle();
    orgId = (data as { org_id?: string } | null)?.org_id ?? null;
  }
  if (!orgId) return { ok: false, status: 401 };

  const { data: membership } = await client
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (membership as { role?: string } | null)?.role;
  if (!role || !(roles as string[]).includes(role)) return { ok: false, status: 401 };

  return { ok: true, client, userId, orgId, role };
}
