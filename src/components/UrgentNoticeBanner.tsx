"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useSession } from "@/lib/auth/RoleContext";
import { useSync } from "@/lib/sync/SyncProvider";
import { getNotices, isAckedBy, ackNotice } from "@/lib/repo/notices";
import { notifyUrgentNotices } from "@/lib/notify/device";
import type { Notice } from "@/lib/types";

/**
 * An urgent notice follows the person across every screen until they
 * acknowledge it.
 *
 * A card on the home screen isn't enough: staff open the app on the checklist
 * or the stock log and never pass through home, so "we're out of Scotch
 * Bonnet" or "table 4 has a nut allergy" could sit unread through a whole
 * service. This sits above the content on every screen, in full danger
 * colour, and the only way past it is to say you've read it — which also
 * gives the manager a real acknowledgement rather than a guess.
 *
 * Non-urgent notices deliberately don't do this. If everything interrupts,
 * nothing does.
 */
export function UrgentNoticeBanner() {
  const { session } = useSession();
  const { dataVersion } = useSync();
  const [pending, setPending] = useState<Notice[]>([]);

  const refresh = useCallback(() => {
    if (!session) return;
    const outstanding = getNotices().filter((n) => n.priority === "urgent" && !isAckedBy(n.id, session.name));
    setPending(outstanding);
    // Covers the case the banner can't: screen off, or the app behind another.
    notifyUrgentNotices(outstanding);
  }, [session]);

  // dataVersion re-runs this when a notice arrives from another device, so an
  // urgent post reaches a phone that's already open and sitting on a screen.
  useEffect(refresh, [refresh, dataVersion]);

  if (!session || pending.length === 0) return null;
  const notice = pending[0];

  return (
    <div className="print:hidden sticky top-0 z-40 bg-danger text-white shadow-lg">
      <div className="px-4 py-3 md:px-8">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">
              Urgent · Khẩn cấp
              {pending.length > 1 && ` — ${pending.length} unread · chưa đọc`}
            </p>
            <p className="font-bold leading-snug mt-0.5">{notice.title.en}</p>
            <p className="font-semibold leading-snug opacity-95">{notice.title.vi}</p>
            <p className="text-sm leading-snug mt-1 opacity-95">{notice.body.en}</p>
            <p className="text-sm leading-snug opacity-90">{notice.body.vi}</p>
            <p className="text-[11px] opacity-80 mt-1">From {notice.postedBy}</p>
          </div>
        </div>
        <button
          onClick={() => {
            ackNotice(notice.id, session.name);
            refresh();
          }}
          className="w-full min-h-12 mt-2.5 rounded-xl bg-white text-danger font-bold flex items-center justify-center gap-2 active:opacity-90"
        >
          <Check size={18} /> I&apos;ve read this · Tôi đã đọc
        </button>
      </div>
    </div>
  );
}
