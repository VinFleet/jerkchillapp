import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PushCategory } from "./categories";

/**
 * Sending the alerts.
 *
 * Server-side only: the VAPID private key signs every push, and anyone holding
 * it could send notifications that appear to come from the restaurant.
 */

/** Devices that never said which branch they belong to predate branches. */
const LEGACY_TENANT = "jerk-and-chill-thao-dien";

export type PushMessage = {
  category: PushCategory;
  title: string;
  body: string;
  /** Where tapping the notification should land. */
  url?: string;
  /** Same tag replaces rather than stacks in the tray. */
  tag?: string;
  /** Keeps it on screen until acted on, and adds a vibration pattern. */
  urgent?: boolean;
  /** Don't notify the device that caused the event — it already knows. */
  excludeEndpoint?: string;
};

export type PushSendSummary = {
  sent: number;
  failed: number;
  removed: number;
  skipped?: "not_configured";
};

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Fan out one alert to everyone who asked for that category.
 *
 * Never throws. This is called from the middle of ordinary actions — saving a
 * booking, logging a complaint — and a notification that fails to send must
 * not roll back the thing that happened.
 */
export async function sendPush(
  message: PushMessage,
  tenantId: string = LEGACY_TENANT
): Promise<PushSendSummary> {
  if (!vapidConfigured()) return { sent: 0, failed: 0, removed: 0, skipped: "not_configured" };
  const db = serviceClient();
  if (!db) return { sent: 0, failed: 0, removed: 0, skipped: "not_configured" };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("tenant_id", tenantId)
    .contains("categories", [message.category]);

  if (error || !data) return { sent: 0, failed: 0, removed: 0 };

  const targets = (data as SubscriptionRow[]).filter(
    (row) => row.endpoint !== message.excludeEndpoint
  );

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/home",
    tag: message.tag ?? message.category,
    urgent: message.urgent ?? false,
  });

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];

  await Promise.all(
    targets.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          { TTL: 60 * 60 * 6 }
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser threw the subscription away — an uninstalled
        // PWA, a wiped phone. Keeping it would mean retrying forever against a
        // device that no longer exists.
        if (status === 404 || status === 410) gone.push(row.endpoint);
        else failed += 1;
      }
    })
  );

  if (gone.length > 0) {
    await db
      .from("push_subscriptions")
      .delete()
      .in("endpoint", gone)
      .then(
        () => undefined,
        () => undefined
      );
  }

  return { sent, failed, removed: gone.length };
}

/** Send to exactly one device — used by the "send me a test" button. */
export async function sendPushToEndpoint(
  endpoint: string,
  message: Omit<PushMessage, "category" | "excludeEndpoint">
): Promise<boolean> {
  if (!vapidConfigured()) return false;
  const db = serviceClient();
  if (!db) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error || !data) return false;

  const row = data as SubscriptionRow;
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify({
        title: message.title,
        body: message.body,
        url: message.url ?? "/home",
        tag: message.tag ?? "jc-test",
        urgent: message.urgent ?? false,
      })
    );
    return true;
  } catch {
    return false;
  }
}
