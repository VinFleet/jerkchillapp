import type { ModuleId } from "@/lib/auth/permissions";
import type { Role, ChecklistArea, ChecklistShift } from "@/lib/types";
import { getNotices, isAckedBy } from "@/lib/repo/notices";
import { getCompletion } from "@/lib/repo/checklists";
import { todayIso } from "@/lib/storage";

/**
 * Counts shown on the navigation itself.
 *
 * Urgent notices interrupt (see UrgentNoticeBanner); everything else needs a
 * quieter route that still can't be missed. A number on the tab means someone
 * standing at the pass sees there's something waiting without opening
 * anything — and, unlike the home screen, the nav is on every screen.
 */
/** Keyed by the nav item's module, which includes "home" — hence the wider key type. */
export type NavBadges = Partial<Record<ModuleId | "home", number>>;

function currentShift(): ChecklistShift {
  return new Date().getHours() < 16 ? "opening" : "closing";
}

function primaryArea(role: Role): ChecklistArea {
  return role === "bartender" ? "foh" : "kitchen";
}

export function getNavBadges(role: Role, staffName: string): NavBadges {
  const badges: NavBadges = {};

  const unread = getNotices().filter((n) => !isAckedBy(n.id, staffName)).length;
  if (unread > 0) badges.notices = unread;

  // Only the person who actually completes the list gets nagged about it, and
  // only while it's still outstanding.
  const { done, total } = getCompletion(primaryArea(role), currentShift(), todayIso());
  if (total > 0 && done < total) badges.checklists = total - done;

  return badges;
}
