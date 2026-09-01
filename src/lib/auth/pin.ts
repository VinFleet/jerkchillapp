/**
 * Staff PIN hashing — because a plaintext PIN in localStorage is readable by
 * anyone who opens devtools on the shared tablet, and people reuse their
 * bank-card PIN whether you tell them not to or not.
 *
 * Honest scope: a salted SHA-256 of a 4-digit PIN is not cryptography — ten
 * thousand guesses fall in milliseconds to anyone who exfiltrates the hash.
 * What it stops is the casual read: a PIN can no longer be SEEN, in storage,
 * in a sync payload, or over a shoulder on the staff screen. The PIN remains
 * an accountability check, not a security boundary; the device session is
 * the boundary.
 *
 * Stored format: "sha256:<salt-hex>:<digest-hex>". Anything else in the pin
 * field is a legacy plaintext PIN; verifyPin accepts it so nobody is locked
 * out by the upgrade, and callers rehash on first successful use.
 */

const FORMAT = "sha256";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newSalt(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `${FORMAT}:${salt}:${toHex(new Uint8Array(digest))}`;
}

export function isHashedPin(stored: string | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(`${FORMAT}:`);
}

/**
 * True if the entered digits match the stored PIN, in either era's format.
 * A legacy plaintext match should be followed by a rehash — the caller owns
 * that, because only it can write the staff record.
 */
export async function verifyPin(entered: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  if (!isHashedPin(stored)) return entered === stored;
  const [, salt] = stored.split(":");
  if (!salt) return false;
  return (await hashPin(entered, salt)) === stored;
}
