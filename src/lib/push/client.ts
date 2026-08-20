import { DEFAULT_PUSH_CATEGORIES, type PushCategory } from "./categories";

/**
 * Registering this device for alerts, and remembering what its owner chose.
 *
 * The subscription belongs to a browser installation, not to a person — so the
 * staff member is attached to it rather than being it. On the shared kitchen
 * tablet that means the alerts follow whoever last set them up, which is the
 * honest behaviour for a shared device; on someone's own phone it means what
 * you'd expect.
 */

export type PushState =
  | { supported: false }
  | { supported: true; permission: NotificationPermission; subscribed: boolean; categories: PushCategory[] };

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The VAPID public key is safe in the browser — it's the public half. */
function applicationServerKey(): Uint8Array | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  // base64url -> the Uint8Array the Push API wants.
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

/**
 * The current subscription, or null.
 *
 * Uses getRegistration() rather than `.ready`. `.ready` is a promise that never
 * settles when no service worker is registered — in development, before the
 * first activation, or on any browser where registration failed — so awaiting
 * it hung this whole module and the settings screen sat there showing defaults
 * instead of the person's actual choices.
 */
async function existingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function readPushState(): Promise<PushState> {
  if (!pushSupported()) return { supported: false };
  const permission = Notification.permission;
  const subscription = await existingSubscription();
  return {
    supported: true,
    permission,
    subscribed: Boolean(subscription),
    categories: readLocalCategories(),
  };
}

const CATEGORIES_KEY = "jc_push_categories";

/**
 * The chosen categories are mirrored locally as well as stored server-side.
 * The settings screen has to render instantly and offline; the server copy is
 * what the send path actually consults.
 */
export function readLocalCategories(): PushCategory[] {
  if (typeof window === "undefined") return DEFAULT_PUSH_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return DEFAULT_PUSH_CATEGORIES;
    return JSON.parse(raw) as PushCategory[];
  } catch {
    return DEFAULT_PUSH_CATEGORIES;
  }
}

/**
 * Exported because people tick their choices *before* turning alerts on — read
 * the list, choose, then enable. Persisting only on subscribe meant those
 * choices were lost on reload, and the person came back to the defaults with no
 * indication anything had been forgotten.
 */
export function saveCategoriesLocally(categories: PushCategory[]) {
  try {
    window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    /* a full device shouldn't break the toggle */
  }
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "not_configured" | "denied" | "failed" };

/**
 * Turn alerts on for this device.
 *
 * Asks the browser for permission first — which can only be done from a real
 * tap, so this must be called from a click handler, not on page load. Browsers
 * permanently block a site that asks unprompted, and there is no way back from
 * that except the user digging through settings.
 */
export async function enablePush(
  staff: { id: string | null; name: string },
  categories: PushCategory[] = DEFAULT_PUSH_CATEGORIES
): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const key = applicationServerKey();
  if (!key) return { ok: false, reason: "not_configured" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    // `.ready` is right here — we need an *active* worker to subscribe against
    // — but it can hang, so it races a timeout rather than leaving the button
    // spinning with no explanation.
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    if (!registration) return { ok: false, reason: "failed" };
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push must always result in something
        // the person can see. Silent background pushes aren't permitted.
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        staffId: staff.id,
        staffName: staff.name,
        categories,
      }),
    });
    if (!res.ok) return { ok: false, reason: "failed" };

    saveCategoriesLocally(categories);
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Change which alerts this device receives, without re-asking permission. */
export async function updateCategories(
  staff: { id: string | null; name: string },
  categories: PushCategory[]
): Promise<boolean> {
  saveCategoriesLocally(categories);
  const subscription = await existingSubscription();
  if (!subscription) return false;
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        staffId: staff.id,
        staffName: staff.name,
        categories,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Turn alerts off.
 *
 * Removes the row as well as the browser subscription — leaving the row would
 * mean the server kept pushing to a device whose owner opted out, which is
 * exactly the thing that makes people disable notifications at the OS level
 * and never come back.
 */
export async function disablePush(): Promise<boolean> {
  const subscription = await existingSubscription();
  if (!subscription) return true;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    /* fall through — still tell the server to stop */
  }
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    return true;
  } catch {
    return false;
  }
}

/** Ask the server to send this device a test alert, so people can see it works. */
export async function sendTestPush(): Promise<boolean> {
  const subscription = await existingSubscription();
  if (!subscription) return false;
  try {
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
