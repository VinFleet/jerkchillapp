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
  oaId: string;
  bookingTemplateId: string;
  /** Sends go to Zalo's dev wallet and only reach OA admins. */
  developmentMode: boolean;
};

function readConfig(): ZaloConfig | null {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  const oaId = process.env.ZALO_OA_ID;
  const bookingTemplateId = process.env.ZALO_BOOKING_TEMPLATE_ID;

  if (!appId || !appSecret || !oaId || !bookingTemplateId) return null;

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

export function zaloIsConfigured(): boolean {
  return typeof window === "undefined" && readConfig() !== null;
}

/** Service-role Supabase credentials, used only for the locked-down token table. */
export function getServiceRoleCredentials(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
