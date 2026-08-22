/**
 * Mints the ONE fixed PKCE pair the Zalo OA console flow needs.
 *
 * Run once: npm run zalo:pkce
 *
 * The challenge goes into the Zalo console (Sản phẩm → Official Account →
 * Thiết lập chung → Code Challenge). The verifier goes into Vercel as
 * ZALO_PKCE_VERIFIER. They are a matched pair — regenerating one without the
 * other breaks the token exchange with an error that explains nothing.
 */
import crypto from "node:crypto";

const b64url = (b) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash("sha256").update(verifier, "ascii").digest());

console.log("");
console.log("  Paste into Vercel as ZALO_PKCE_VERIFIER:");
console.log("  " + verifier);
console.log("");
console.log("  Paste into the Zalo console as Code Challenge:");
console.log("  " + challenge);
console.log("");
console.log("  (verifier is " + verifier.length + " chars — Zalo requires exactly 43)");
console.log("");
