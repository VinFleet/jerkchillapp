import crypto from "node:crypto";

/**
 * PKCE for Zalo's OA consent flow.
 *
 * IMPORTANT: the OA flow uses ONE FIXED PAIR, not a pair per request.
 *
 * The challenge is a saved setting in the developer console, so the matching
 * verifier is long-lived configuration — `ZALO_PKCE_VERIFIER` — not a
 * per-request secret. Minting a fresh pair per request is textbook RFC 7636 and
 * is correct for Zalo's *Social* flow, but on the OA flow it fails at
 * /v4/oa/access_token: the console holds a fixed challenge that a freshly
 * minted verifier can never match. That failure would surface only after the
 * console callback is registered, and would look like an unrelated regression.
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

/**
 * Mint a new pair.
 *
 * Used once, at setup, to produce the challenge that goes into the console and
 * the verifier that goes into the environment. NOT called per request on the OA
 * flow — see the note above.
 */
export function createPkce(): Pkce {
  // 32 random bytes base64url-encode to exactly 43 characters.
  const verifier = base64url(crypto.randomBytes(32));
  return { verifier, challenge: challengeFor(verifier) };
}

/** The configured verifier whose challenge is saved in the Zalo console. */
export function configuredVerifier(): string | null {
  return process.env.ZALO_PKCE_VERIFIER || null;
}

export function challengeFor(verifier: string): string {
  // .digest() with no encoding returns the raw bytes, which is the point.
  return base64url(crypto.createHash("sha256").update(verifier, "ascii").digest());
}

/** A CSRF nonce for the `state` round-trip. */
export function createState(): string {
  return base64url(crypto.randomBytes(16));
}
