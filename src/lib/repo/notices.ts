import type { Notice, NoticeAck, Role, NoticePriority } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, newId, isLegacyTenant } from "@/lib/storage";
import { SEED_NOTICES } from "@/lib/seed/notices";
import { raiseAlert } from "@/lib/push/alert";

const NOTICES_KEY = "notices";
const ACKS_KEY = "notice_acks";

export function ensureNoticesSeeded() {
  // Jerk & Chill's data belongs to Jerk & Chill. A neutral branch starts
  // empty here and its owner builds their own — the seed below is customer
  // number one's restaurant, not a template.
  if (!isLegacyTenant()) {
    markSeeded(NOTICES_KEY);
    return;
  }

  if (isSeeded(NOTICES_KEY)) return;
  writeList(NOTICES_KEY, SEED_NOTICES);
  markSeeded(NOTICES_KEY);
}

export function getNotices(): Notice[] {
  return readList<Notice>(NOTICES_KEY).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function postNotice(
  title: { en: string; vi: string },
  body: { en: string; vi: string },
  postedBy: string,
  role: Role,
  priority: NoticePriority
) {
  const all = readList<Notice>(NOTICES_KEY);
  all.push({
    id: newId("notice"),
    title,
    body,
    postedBy,
    role,
    priority,
    createdAt: new Date().toISOString(),
  });
  writeList(NOTICES_KEY, all);

  // An urgent notice is the clearest case for interrupting people: the manager
  // has explicitly said this cannot wait until someone next opens the app.
  if (priority === "urgent") {
    raiseAlert({
      category: "notices",
      title: { en: "Urgent notice", vi: "Thông báo khẩn" },
      body: { en: `${title.en} — from ${postedBy}`, vi: `${title.vi} — từ ${postedBy}` },
      url: "/notices",
      urgent: true,
    });
  }
}

export function getAcks(noticeId: string): NoticeAck[] {
  return readList<NoticeAck>(ACKS_KEY).filter((a) => a.noticeId === noticeId);
}

export function isAckedBy(noticeId: string, staffName: string): boolean {
  return getAcks(noticeId).some((a) => a.staffName === staffName);
}

export function ackNotice(noticeId: string, staffName: string) {
  if (isAckedBy(noticeId, staffName)) return;
  const all = readList<NoticeAck>(ACKS_KEY);
  all.push({ noticeId, staffName, ackedAt: new Date().toISOString() });
  writeList(ACKS_KEY, all);
}
