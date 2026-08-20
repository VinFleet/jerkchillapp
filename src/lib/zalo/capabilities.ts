/**
 * Turning the Official Account's three gating flags into a plain answer.
 *
 * Zalo scatters the prerequisites for each feature across the console —
 * verification, the package tier, and whether a Cloud Account is linked live in
 * different places, and none of them says which feature it blocks. Getting
 * "why won't it send?" wrong costs a service; getting it right is arithmetic on
 * three booleans.
 *
 * Import-free on purpose, like the mention guard: this is the logic worth
 * testing, and it shouldn't need a network or credentials to run.
 */

export type OaInfo = {
  oaid: string;
  name: string;
  isVerified: boolean;
  packageName: string | null;
  packageValidThrough: string | null;
  linkedZca: boolean;
  followers: number | null;
};

export type Capability = { available: boolean; blockedBy: string[] };

export type OaCapabilities = {
  /** Post into an OA-owned staff group. Free to send. */
  groupMessaging: Capability;
  /** Booking confirmations to guests by phone number. Paid per message. */
  bookingConfirmations: Capability;
};

/**
 * Advanced and Premium are the tiers that carry group messaging.
 *
 * Matched loosely on purpose — Zalo returns display names that vary by locale
 * and have been renamed before, so an exact-match list would eventually report
 * a working account as broken.
 */
export function tierAllowsGroups(packageName: string | null): boolean {
  if (!packageName) return false;
  const name = packageName.toLowerCase();
  return name.includes("advanced") || name.includes("premium") || name.includes("nâng cao");
}

export function assessCapabilities(info: OaInfo): OaCapabilities {
  const groupBlockers: string[] = [];
  if (!info.isVerified) groupBlockers.push("The OA is not verified");
  if (!tierAllowsGroups(info.packageName)) {
    groupBlockers.push(
      `Group messaging needs the Advanced or Premium package (currently ${info.packageName ?? "unknown"})`
    );
  }

  const bookingBlockers: string[] = [];
  if (!info.isVerified) bookingBlockers.push("The OA is not verified");
  if (!info.linkedZca) {
    bookingBlockers.push("No Zalo Cloud Account is linked, so messages cannot be charged");
  }

  return {
    groupMessaging: { available: groupBlockers.length === 0, blockedBy: groupBlockers },
    bookingConfirmations: { available: bookingBlockers.length === 0, blockedBy: bookingBlockers },
  };
}
