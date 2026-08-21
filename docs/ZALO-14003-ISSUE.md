# Zalo OA OAuth — `-14003 Invalid redirect uri`

**Status:** unresolved
**Date:** 2026-08-21
**Goal:** connect a Zalo Official Account to a Next.js app so it can post
operational alerts into an OA-owned staff group.

---

## The problem in one line

`GET https://oauth.zaloapp.com/v4/oa/permission?...` returns **`-14003 Invalid
redirect uri`**, despite the redirect URI's domain *and* URL prefix both being
authenticated in the Zalo console.

---

## Exact request being sent

Captured live from production (`curl -o /dev/null -w "%{redirect_url}"` against
our `/api/zalo/connect` route):

```
https://oauth.zaloapp.com/v4/oa/permission
  ?app_id=1397345074596379506
  &redirect_uri=https%3A%2F%2Fjerkchillapp.vercel.app%2Fapi%2Fzalo%2Fcallback
  &code_challenge=<43-char base64url>
  &state=<CSRF nonce>
```

Decoded `redirect_uri`:

```
https://jerkchillapp.vercel.app/api/zalo/callback
```

Note: **no `code_challenge_method` parameter** — the spec we are working from
states S256 is implicit for Zalo and that sending the parameter is undocumented.

---

## What is already confirmed working

| Thing | Evidence |
|---|---|
| App ID / secret valid | Authorize URL builds; `-14003` is a redirect error, not an auth error |
| Domain authenticated | Console shows `jerkchillapp.vercel.app` under "Danh sách domain xác thực (1/20)" |
| URL prefix authenticated | Console accepted `https://jerkchillapp.vercel.app/api/zalo/callback/` — user confirms "passed" |
| Verification file reachable | `GET /api/zalo/callback/zalo_verifierKkI46RAL1nXiuhOKYySC7NxIkI6If6DuC30m.html` → **200**, correct token |
| Verification meta tag | present on the callback URL AND site-wide |
| Callback route live | `GET /api/zalo/callback?code=x&state=y` → **307** (our redirect to settings) |
| OA created | Yes |
| OA linked to app | Yes — "List of authorized OAs" no longer 0 |
| Deployment protection | Disabled — all routes publicly reachable, no Vercel SSO wall |

### Trailing-slash behaviour (potentially relevant)

Zalo's "Authenticate ownership" dialog showed the URL **with** a trailing slash:
`https://jerkchillapp.vercel.app/api/zalo/callback/`

Our app sends it **without**. Next.js 308-redirects the slash form to the
non-slash form and **preserves query params**:

```
GET /api/zalo/callback/            -> 308 -> /api/zalo/callback
GET /api/zalo/callback/?code=x     -> 308 -> /api/zalo/callback?code=x
```

So either form works end-to-end on our side. Untested: whether Zalo compares
the registered string **exactly** (in which case the trailing slash is the bug)
or as a **prefix**.

---

## Hypotheses, untested

1. **Trailing slash mismatch.** Registered `.../callback/`, sending `.../callback`.
   Cheapest test: set `ZALO_REDIRECT_URI` to the slash form and redeploy.
2. **Callback URL must be registered in a separate allowlist.** Our reference
   spec says: *"The Callback URL must be registered in App Management → Đăng nhập
   (Login) → Add Platform → Web. No wildcard/prefix-matching rules are
   documented — assume exact match."* — but that sentence appears in the
   **Social API** section, not the OA section. It is unclear whether OA OAuth
   uses the same allowlist. **This screen has not been located/filled in yet.**
3. **Domain/URL-prefix authentication proves ownership only**, and is not the
   allowlist `-14003` checks against.
4. **App type mismatch** — the app may need a "Web" platform declared before it
   will accept any web redirect URI at all.

---

## Key questions to answer

- For the **OA** flow (`/v4/oa/permission`, not `/v4/permission`), where exactly
  is the redirect URI allowlisted?
- Is the match exact or prefix-based? Does a trailing slash matter?
- Does the app need a Web platform registered under Login before OA OAuth works?
- Is `-14003` ever caused by something other than the redirect URI — e.g. the
  app not having a required permission or product enabled?

---

## Environment

- Next.js 16 (App Router), deployed on Vercel
- Production domain: `https://jerkchillapp.vercel.app`
- Also resolves at branch URL `jerkchillapp-git-main-vinfleets-projects.vercel.app`
  (**not** domain-authenticated; `ZALO_REDIRECT_URI` pins the production one)
- Env vars set in Vercel: `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_REDIRECT_URI`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ZALO_OA_ID` deliberately unset — Zalo returns `oa_id` on the callback

---

## Code

### `src/app/api/zalo/connect/route.ts` — builds the authorize URL

```ts
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
```

### `src/lib/zalo/pkce.ts` — PKCE, with Zalo's three documented quirks

```ts
import crypto from "node:crypto";

/**
 * PKCE for Zalo's OA consent flow.
 *
 * Standard RFC 7636 S256, but with three Zalo-specific quirks that make
 * copy-pasting a generic implementation fail:
 *
 *  - the verifier is pinned at exactly 43 characters, not RFC's 43–128 range
 *  - there is no `code_challenge_method` parameter; S256 is implicit, and
 *    sending the parameter is undocumented
 *  - the challenge hashes the RAW 32-byte digest, not its 64-character hex
 *    string — the mistake that produces a silent, unexplainable mismatch
 */

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type Pkce = { verifier: string; challenge: string };

export function createPkce(): Pkce {
  // 32 random bytes base64url-encode to exactly 43 characters.
  const verifier = base64url(crypto.randomBytes(32));
  return { verifier, challenge: challengeFor(verifier) };
}

export function challengeFor(verifier: string): string {
  // .digest() with no encoding returns the raw bytes, which is the point.
  return base64url(crypto.createHash("sha256").update(verifier, "ascii").digest());
}

/** A CSRF nonce for the `state` round-trip. */
export function createState(): string {
  return base64url(crypto.randomBytes(16));
}
```

### `src/app/api/zalo/callback/route.ts` — receives the redirect

```ts
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
```

### `src/lib/zalo/config.ts` — server-only config

```ts
/**
 * Server-side Zalo configuration.
 *
 * Every value here is a secret. None of these names carry the `NEXT_PUBLIC_`
 * prefix, which is what keeps them out of the browser bundle — a leaked app
 * secret lets anyone send messages as the restaurant, and it is also the
 * webhook signing key.
 *
 * The whole integration is off unless all four are present, so the app runs
 * exactly as before until the Official Account actually exists.
 */

export type ZaloConfig = {
  appId: string;
  appSecret: string;
  /**
   * Optional. Zalo returns `oa_id` on the consent callback, which is how you
   * learn which Official Account was authorised — so requiring it up front
   * would send the owner hunting for a value the flow is about to hand us.
   * When set, it is enforced: approving a different OA is rejected.
   */
  oaId: string | null;
  bookingTemplateId: string | null;
  /** Sends go to Zalo's dev wallet and only reach OA admins. */
  developmentMode: boolean;
};

function readConfig(): ZaloConfig | null {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  const oaId = process.env.ZALO_OA_ID ?? null;
  // Only the booking-confirmation path needs a template; group messaging and
  // the connection itself do not, so it must not gate the whole integration.
  const bookingTemplateId = process.env.ZALO_BOOKING_TEMPLATE_ID ?? null;

  if (!appId || !appSecret) return null;

  return {
    appId,
    appSecret,
    oaId,
    bookingTemplateId,
    developmentMode: process.env.ZALO_DEVELOPMENT_MODE === "true",
  };
}

export function getZaloConfig(): ZaloConfig | null {
  if (typeof window !== "undefined") {
    // Belt and braces. Nothing should import this from a client component, and
    // if something does, it should fail loudly here rather than quietly ship a
    // secret to every guest who opens the booking page.
    throw new Error("Zalo config is server-only and must never be read in the browser");
  }
  return readConfig();
}

/** Whether Zalo is connected at all — app id and secret present. */
export function zaloIsConfigured(): boolean {
  return typeof window === "undefined" && readConfig() !== null;
}

/**
 * Whether guest booking confirmations specifically can be sent.
 *
 * Separate from zaloIsConfigured because the group-message path needs no
 * template — treating them as one flag would have blocked free group alerts on
 * a paid feature the restaurant may never enable.
 */
export function zaloBookingConfirmationsConfigured(): boolean {
  const cfg = typeof window === "undefined" ? readConfig() : null;
  return Boolean(cfg?.bookingTemplateId);
}

/** Service-role Supabase credentials, used only for the locked-down token table. */
export function serviceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getServiceRoleCredentials(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
```

---

## Token exchange (not yet reached — fails before this)

For completeness, the exchange that runs once a code comes back. Two
Zalo-specific deviations are encoded here and are worth checking if the flow
gets past `-14003`:

- the app secret travels in a **`secret_key` HTTP header**, not the body
- `expires_in` arrives as a **string**

```ts
const res = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    secret_key: cfg.appSecret,
  },
  body: new URLSearchParams({
    app_id: cfg.appId,
    code,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  }),
});
```

Refresh tokens are single-use and rotating; the store commits the new pair
before returning the access token, guarded by a compare-and-swap so two
serverless invocations can't spend the same refresh token.

---

## What has been tried

1. ✅ Verified domain `jerkchillapp.vercel.app` (HTML file method) → still `-14003`
2. ✅ Set `ZALO_REDIRECT_URI` to pin the production domain (was defaulting to the
   branch URL, which is not authenticated) → still `-14003`
3. ✅ Created the OA, linked it to the app → still `-14003`
4. ✅ Authenticated the URL prefix `https://jerkchillapp.vercel.app/api/zalo/callback/`
   → still `-14003`
5. ⬜ Trailing-slash `ZALO_REDIRECT_URI` — **not yet tried**
6. ⬜ Registering the callback under Login → Add Platform → Web — **not yet located**

---

## Reference docs in this repo

- [`docs/ZALO_API.md`](ZALO_API.md) — full compiled platform spec
- [`docs/ZALO_RULES.md`](ZALO_RULES.md) — working rules and hard invariants
- [`src/lib/zalo/zalo-errors.json`](../src/lib/zalo/zalo-errors.json) — machine-readable
  error table (note: **`-14003` is not in it** — the table covers OA/ZBS/Social/Mini App
  runtime errors, not OAuth authorize-endpoint errors, which appear to be a separate
  `-14xxx` family)

## Note on `-14003` specifically

It does **not** appear in the compiled error table, which is itself informative:
the `-14xxx` range comes from the `oauth.zaloapp.com` authorize endpoint, whereas
the documented tables cover `openapi.zalo.me` / `business.openapi.zalo.me`
runtime errors. Any answer will likely come from Zalo's OAuth/login
documentation or support, not the API error appendix.
