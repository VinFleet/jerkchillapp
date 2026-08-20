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
