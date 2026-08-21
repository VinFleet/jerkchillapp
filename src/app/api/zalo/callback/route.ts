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

/**
 * Zalo verifies ownership of a URL prefix by fetching that exact URL and
 * looking for its verification meta tag. This route normally answers with a
 * redirect, which a crawler can't read a tag out of — so a bare GET, with no
 * query string at all, serves a minimal HTML page carrying the tag instead.
 *
 * Safe to distinguish this way: a real OAuth return always carries at least
 * `code` or `state`, so nothing with query parameters is ever treated as a
 * verification probe.
 */
const VERIFICATION_TOKEN = "KkI46RAL1nXiuhOKYySC7NxIkI6If6DuC30m";

function verificationPage(): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta name="zalo-platform-site-verification" content="${VERIFICATION_TOKEN}" /></head><body>Jerk &amp; Chill — Zalo callback</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // No parameters at all — this is the ownership check, not a user coming back
  // from consent.
  if ([...url.searchParams.keys()].length === 0) return verificationPage();

  const cfg = getZaloConfig();
  if (!cfg) return done(request, { connected: "0", reason: "not_configured" });

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

  // Zalo returns oa_id on the callback. When ZALO_OA_ID is configured it is
  // enforced — approving some other Official Account is a mistake worth
  // catching. When it isn't, this callback is how we learn which OA we have,
  // so there is nothing to compare against and the returned value is stored.
  if (cfg.oaId && oaId && oaId !== cfg.oaId) {
    return done(request, { connected: "0", reason: "wrong_oa" });
  }
  const effectiveOaId = oaId ?? cfg.oaId;
  if (!effectiveOaId) {
    return done(request, { connected: "0", reason: "no_oa_id" });
  }

  try {
    await exchangeAuthorizationCode(cfg, code, verifier, effectiveOaId);
    return done(request, { connected: "1" });
  } catch {
    return done(request, { connected: "0", reason: "exchange_failed" });
  }
}
