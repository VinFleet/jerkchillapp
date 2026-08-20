import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ZaloError } from "./errors";
import { getServiceRoleCredentials, type ZaloConfig } from "./config";

/**
 * The Zalo token store.
 *
 * Zalo's refresh tokens are single-use and rotating: a successful refresh kills
 * the token that was used and hands back a new pair. Two consequences drive
 * everything below.
 *
 * First, the new pair must be committed to the database *before* the access
 * token is handed to a caller. If the process dies in between — and on a
 * serverless host it can, at any moment — Zalo has rotated the grant but we no
 * longer hold the only copy of the new refresh token, and an OA admin has to
 * re-consent in a browser to recover.
 *
 * Second, two invocations must not refresh at once, or one of them spends a
 * refresh token the other has already invalidated. There is no shared lock
 * between serverless invocations, so this uses a compare-and-swap on
 * `rotated_at` instead: whoever writes first wins, and the loser re-reads and
 * uses the winner's token rather than burning another rotation.
 */

const OA_TOKEN_URL = "https://oauth.zaloapp.com/v4/oa/access_token";

/** Refresh this far ahead of the 25-hour expiry rather than waiting for a -220. */
const REFRESH_SKEW_MS = 5 * 60 * 60 * 1000;

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  rotatedAt: string;
};

type TokenRow = {
  access_token: string;
  refresh_token: string;
  access_expires: string;
  rotated_at: string;
};

function serviceClient(): SupabaseClient {
  const creds = getServiceRoleCredentials();
  if (!creds) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the Zalo token store cannot be reached"
    );
  }
  return createClient(creds.url, creds.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function audit(db: SupabaseClient, oaId: string, event: string, detail?: string) {
  // Best-effort: never let the audit trail break a send.
  await db
    .from("zalo_token_audit")
    .insert({ scope: "oa", subject_id: oaId, event, detail: detail ?? null })
    .then(
      () => undefined,
      () => undefined
    );
}

function rowToTokenSet(row: TokenRow): TokenSet {
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    accessExpiresAt: new Date(row.access_expires).getTime(),
    rotatedAt: row.rotated_at,
  };
}

async function loadTokens(db: SupabaseClient, oaId: string): Promise<TokenSet | null> {
  const { data, error } = await db
    .from("zalo_tokens")
    .select("access_token, refresh_token, access_expires, rotated_at")
    .eq("scope", "oa")
    .eq("subject_id", oaId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToTokenSet(data as TokenRow);
}

/**
 * Ask Zalo for a token.
 *
 * Note the two deviations from ordinary OAuth that the spec is emphatic about:
 * the app secret travels in a `secret_key` HTTP header rather than the body,
 * and `expires_in` comes back as a string.
 */
async function tokenRequest(
  cfg: ZaloConfig,
  body: Record<string, string>
): Promise<Omit<TokenSet, "rotatedAt">> {
  const res = await fetch(OA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: cfg.appSecret,
    },
    body: new URLSearchParams({ app_id: cfg.appId, ...body }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string;
    error?: number;
    message?: string;
  };

  if (!json.access_token || !json.refresh_token) {
    throw new ZaloError(json.error ?? -1, json.message ?? "Zalo token request failed", json);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessExpiresAt: Date.now() + Number(json.expires_in ?? "90000") * 1000,
  };
}

/**
 * Exchange the one-time authorization code for the first token pair.
 *
 * Called once, from the OAuth callback, when the owner first connects the
 * Official Account.
 */
export async function exchangeAuthorizationCode(
  cfg: ZaloConfig,
  code: string,
  codeVerifier: string
): Promise<void> {
  const db = serviceClient();
  const next = await tokenRequest(cfg, {
    code,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const { error } = await db.from("zalo_tokens").upsert(
    {
      scope: "oa",
      subject_id: cfg.oaId,
      access_token: next.accessToken,
      refresh_token: next.refreshToken,
      access_expires: new Date(next.accessExpiresAt).toISOString(),
      rotated_at: new Date().toISOString(),
    },
    { onConflict: "scope,subject_id" }
  );
  if (error) throw new Error(`Could not store the Zalo grant: ${error.message}`);
  await audit(db, cfg.oaId, "exchange");
}

/**
 * A usable access token, refreshing first if it is close to expiry.
 *
 * Throws rather than returning null when there is no grant at all: that is a
 * setup problem a person has to fix, and silently doing nothing would hide it.
 */
export async function getValidAccessToken(cfg: ZaloConfig): Promise<string> {
  const db = serviceClient();
  const current = await loadTokens(db, cfg.oaId);
  if (!current) {
    throw new ZaloError(
      -135,
      "No Zalo grant stored — the owner needs to connect the Official Account"
    );
  }

  if (Date.now() < current.accessExpiresAt - REFRESH_SKEW_MS) {
    return current.accessToken;
  }

  let next: Omit<TokenSet, "rotatedAt">;
  try {
    next = await tokenRequest(cfg, {
      refresh_token: current.refreshToken,
      grant_type: "refresh_token",
    });
  } catch (err) {
    await audit(db, cfg.oaId, "refresh_failed", err instanceof Error ? err.message : String(err));
    throw err;
  }

  // Commit before use, and only if nobody else rotated while we were away.
  // `rotated_at` is the compare-and-swap guard: matching it proves the row is
  // still the one whose refresh token we just spent.
  const rotatedAt = new Date().toISOString();
  const { data, error } = await db
    .from("zalo_tokens")
    .update({
      access_token: next.accessToken,
      refresh_token: next.refreshToken,
      access_expires: new Date(next.accessExpiresAt).toISOString(),
      rotated_at: rotatedAt,
    })
    .eq("scope", "oa")
    .eq("subject_id", cfg.oaId)
    .eq("rotated_at", current.rotatedAt)
    .select("access_token");

  if (error) {
    // We hold a rotated pair we could not persist. This is the unrecoverable
    // case the design exists to avoid, so it is logged loudly rather than
    // swallowed.
    await audit(db, cfg.oaId, "refresh_failed", `persist failed: ${error.message}`);
    throw new Error(
      `Zalo token rotated but could not be saved (${error.message}) — reconnect the Official Account`
    );
  }

  if (!data || data.length === 0) {
    // Another invocation won the race and wrote first. Ours is now the stale
    // one; use theirs rather than rotating again.
    const winner = await loadTokens(db, cfg.oaId);
    if (winner) return winner.accessToken;
    throw new Error("Zalo token refresh raced and no grant remains — reconnect the Official Account");
  }

  await audit(db, cfg.oaId, "refresh");
  return next.accessToken;
}
