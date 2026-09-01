import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The gate on every platform-admin route.
 *
 * The caller sends their own session token; the server identifies them with
 * it, then asks platform_admins whether they run the platform. Only after
 * both is the service-role client handed back — admin power never leaves the
 * server, and a request without proof is a 401 that says nothing else.
 */
export async function requireAdmin(
  request: Request
): Promise<{ ok: true; client: SupabaseClient; userId: string } | { ok: false; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 503 };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401 };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error } = await client.auth.getUser(token);
  const userId = userData?.user?.id;
  if (error || !userId) return { ok: false, status: 401 };

  const { data: adminRow } = await client
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!adminRow) return { ok: false, status: 401 };

  return { ok: true, client, userId };
}

/** Lowercase-and-dashes, from any name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
