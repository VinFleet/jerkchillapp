import { NextResponse } from "next/server";
import { createPkce, createState } from "@/lib/zalo/pkce";
import { getZaloConfig } from "@/lib/zalo/config";

/**
 * Starts the Official Account consent flow.
 *
 * The owner opens this once, approves the app against their OA, and Zalo
 * redirects back to /api/zalo/callback with a code. Everything after that is
 * automatic for the life of the grant.
 *
 * The PKCE verifier and the CSRF nonce ride in httpOnly cookies rather than a
 * database: they are needed for exactly one round trip, they must not be
 * readable by scripts, and a serverless instance cannot rely on holding memory
 * between the two requests.
 */

export const runtime = "nodejs";

const AUTHORIZE_URL = "https://oauth.zaloapp.com/v4/oa/permission";

export async function GET(request: Request) {
  const cfg = getZaloConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Zalo isn't configured — add ZALO_APP_ID, ZALO_APP_SECRET and ZALO_OA_ID first." },
      { status: 400 }
    );
  }

  const redirectUri = process.env.ZALO_REDIRECT_URI ?? new URL("/api/zalo/callback", request.url).toString();
  const { verifier, challenge } = createPkce();
  const state = createState();

  const params = new URLSearchParams({
    app_id: cfg.appId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    state,
  });
  // Note: no `code_challenge_method`. S256 is implicit for Zalo and sending
  // the parameter is undocumented.

  const response = NextResponse.redirect(`${AUTHORIZE_URL}?${params}`);
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/zalo",
    // The authorization code is valid for 10 minutes; the round trip cannot
    // legitimately outlive that.
    maxAge: 600,
  };
  response.cookies.set("zalo_pkce_verifier", verifier, cookie);
  response.cookies.set("zalo_oauth_state", state, cookie);
  return response;
}
