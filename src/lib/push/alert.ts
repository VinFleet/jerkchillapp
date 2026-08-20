import type { PushCategory } from "./categories";

/**
 * Raising an alert from wherever something happened.
 *
 * Fire-and-forget by design. These are called from the middle of ordinary
 * actions — saving a booking, logging a complaint, finalising an order — and
 * none of them may fail, slow down or roll back the thing the person was
 * actually doing. Every failure path here ends in silence.
 */

let cachedEndpoint: string | null | undefined;

/**
 * This device's own push endpoint, so the fan-out can skip it.
 *
 * The person who just logged the complaint does not need their own phone to
 * buzz about it, and an alert that tells you what you just did is how staff
 * learn to ignore alerts.
 */
async function ownEndpoint(): Promise<string | null> {
  if (cachedEndpoint !== undefined) return cachedEndpoint;
  try {
    if (!("serviceWorker" in navigator)) {
      cachedEndpoint = null;
      return null;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    cachedEndpoint = subscription?.endpoint ?? null;
  } catch {
    cachedEndpoint = null;
  }
  return cachedEndpoint;
}

export type AlertInput = {
  category: PushCategory;
  title: { en: string; vi: string };
  body: { en: string; vi: string };
  url?: string;
  tag?: string;
  urgent?: boolean;
};

/**
 * Both languages go in the notification itself.
 *
 * A phone's notification tray is the one screen the app cannot re-render
 * bilingually later — whatever is sent is what the person reads, so it carries
 * both rather than guessing which one they need.
 */
export function raiseAlert(input: AlertInput): void {
  void (async () => {
    try {
      const excludeEndpoint = await ownEndpoint();
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: input.category,
          title: `${input.title.en} · ${input.title.vi}`,
          body: `${input.body.en}\n${input.body.vi}`,
          url: input.url,
          tag: input.tag,
          urgent: input.urgent ?? false,
          excludeEndpoint,
        }),
      });
    } catch {
      // Offline, or alerts aren't configured. The action that triggered this
      // has already been saved locally and will sync; the alert is the part
      // that can be lost without consequence.
    }
  })();
}
