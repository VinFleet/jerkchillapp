import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/zalo/tokens";
import { getZaloConfig } from "@/lib/zalo/config";

/**
 * Receives Zalo's redirect and completes the connection.
 *
 * The authorization code is single-use and expires in ten minutes, so there is
 * no retry here — a failure sends the owner back to try again rather than
 * silently burning the code.
 */

export const runtime = "nodejs";

function done(request: Request, params: Record<string, string>) {
  const url = new URL("/settings/zalo", request.url);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = NextResponse.redirect(url);
  // The one-shot secrets have served their purpose either way.
  response.cookies.delete("zalo_pkce_verifier");
  response.cookies.delete("zalo_oauth_state");
  return response;
}

export async function GET(request: Request) {
  const cfg = getZaloConfig();
  if (!cfg) return done(request, { connected: "0", reason: "not_configured" });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oaId = url.searchParams.get("oa_id");

  const cookies = request.headers.get("cookie") ?? "";
  const read = (name: string) =>
    cookies
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1);

  const verifier = read("zalo_pkce_verifier");
  const expectedState = read("zalo_oauth_state");

  if (!code) return done(request, { connected: "0", reason: "no_code" });
  // Compared as an equality on values we issued — a mismatch means this
  // redirect did not originate from the flow we started.
  if (!expectedState || returnedState !== expectedState) {
    return done(request, { connected: "0", reason: "bad_state" });
  }
  if (!verifier) return done(request, { connected: "0", reason: "expired" });

  // Zalo returns oa_id on the callback; if it disagrees with the configured
  // one, the owner approved a different Official Account than this app expects.
  if (oaId && oaId !== cfg.oaId) {
    return done(request, { connected: "0", reason: "wrong_oa" });
  }

  try {
    await exchangeAuthorizationCode(cfg, code, verifier);
    return done(request, { connected: "1" });
  } catch {
    return done(request, { connected: "0", reason: "exchange_failed" });
  }
}
