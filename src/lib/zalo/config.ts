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
export function getServiceRoleCredentials(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
