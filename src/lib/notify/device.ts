/**
 * Device notifications for urgent notices.
 *
 * Deliberately *local* notifications, not web push. Web push needs a server
 * holding VAPID keys and a subscription per device; this app has no server of
 * its own. What it does have is a tablet that stays open on the pass all
 * service and phones with the PWA installed — and those already receive
 * urgent notices in near real time through the sync channel. Firing a system
 * notification at that moment covers the case the banner can't: the screen is
 * off, or the app is behind another one.
 *
 * A device that is fully closed still won't be reached. That's an honest
 * limitation of a serverless PWA, and the reason the in-app banner is the
 * primary mechanism rather than a nicety.
 */

const SEEN_KEY = "jc_notified_notice_ids";

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied";

export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() === "unsupported") return "unsupported";
  const result = await Notification.requestPermission();
  return result as NotifyPermission;
}

/**
 * Ids already notified on THIS device, so the same notice doesn't buzz again
 * on every sync. Kept in plain localStorage rather than the tenant-namespaced
 * store because it's a property of the device, not the restaurant's data.
 */
function seenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  const all = seenIds();
  ids.forEach((id) => all.add(id));
  try {
    // Bounded — this only exists to stop repeat buzzes, not as a record.
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(all).slice(-200)));
  } catch {
    /* a full device must never break notice delivery */
  }
}

export type NotifiableNotice = {
  id: string;
  title: { en: string; vi: string };
  body: { en: string; vi: string };
  postedBy: string;
};

/** Fires a system notification for each urgent notice this device hasn't announced yet. */
export function notifyUrgentNotices(notices: NotifiableNotice[]): number {
  if (notifyPermission() !== "granted" || notices.length === 0) return 0;
  const seen = seenIds();
  const fresh = notices.filter((n) => !seen.has(n.id));
  if (fresh.length === 0) return 0;

  for (const notice of fresh) {
    try {
      const n = new Notification(`⚠ ${notice.title.en} · ${notice.title.vi}`, {
        body: `${notice.body.en}\n${notice.body.vi}\n— ${notice.postedBy}`,
        tag: notice.id, // replaces rather than stacks if it fires twice
        // Urgent notices should persist on screen until dismissed rather than
        // auto-hiding after a few seconds — the whole point is not missing it.
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        // A full navigation, not a router push: this fires from the operating
        // system while the app may be backgrounded or its React tree unmounted,
        // so there is no router instance to reach for.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/notices";
        n.close();
      };
    } catch {
      /* notification construction can throw on some mobile browsers */
    }
  }

  markSeen(fresh.map((n) => n.id));
  return fresh.length;
}
