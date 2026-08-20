"use client";

import Link from "next/link";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { useSync } from "@/lib/sync/SyncProvider";
import { retrySync } from "@/lib/sync/engine";

/**
 * Staff need to know whether what they're looking at is this device's copy or
 * the shared one — especially a manager checking whether the kitchen has
 * finished the opening checklist. Silence here would mean trusting a screen
 * that might be an hour stale.
 */
export function SyncIndicator({ className = "" }: { className?: string }) {
  const { status, pendingCount, pendingPhotos, syncNow } = useSync();

  if (status === "off") return null;

  // The one status worth a full-width warning rather than a discreet label:
  // it needs the manager, and it needs them to go somewhere.
  if (status === "signed_out") {
    return (
      <Link
        href="/login"
        className={`flex items-center gap-1.5 text-[11px] font-bold text-danger ${className}`}
      >
        <AlertTriangle size={13} className="shrink-0" />
        <span className="hidden sm:inline">Not shared — tap to set up</span>
        <span className="sm:hidden">Chưa chia sẻ</span>
      </Link>
    );
  }

  // A photo that hasn't uploaded exists in exactly one place. Say so plainly
  // — losing the device before it syncs would lose the evidence with it.
  if (status === "synced" && pendingPhotos > 0) {
    return (
      <button
        onClick={() => void syncNow()}
        className={`flex items-center gap-1.5 text-[11px] font-semibold text-warning ${className}`}
        aria-label={`${pendingPhotos} photos not backed up yet. Tap to retry.`}
      >
        <CloudOff size={13} />
        <span className="hidden sm:inline">{pendingPhotos} photo{pendingPhotos > 1 ? "s" : ""} not backed up</span>
        <span className="sm:hidden">{pendingPhotos} ảnh chưa lưu</span>
      </button>
    );
  }

  const view = {
    syncing: { icon: RefreshCw, spin: true, tone: "text-muted", en: "Syncing…", vi: "Đang đồng bộ…" },
    synced: { icon: Check, spin: false, tone: "text-success", en: "Up to date", vi: "Đã cập nhật" },
    not_set_up: { icon: Cloud, spin: false, tone: "text-muted", en: "This device only", vi: "Chỉ thiết bị này" },
    // Loud on purpose. Nothing this device records is reaching anyone else,
    // and unlike being offline it will not fix itself when the wifi returns.
    signed_out: { icon: AlertTriangle, spin: false, tone: "text-danger", en: "Not shared — set this device up again", vi: "Chưa chia sẻ — cài đặt lại thiết bị" },
    offline: {
      icon: CloudOff,
      spin: false,
      tone: "text-warning",
      en: pendingCount > 0 ? "Offline — will send when back online" : "Offline",
      vi: pendingCount > 0 ? "Ngoại tuyến — sẽ gửi khi có mạng" : "Ngoại tuyến",
    },
    error: { icon: AlertTriangle, spin: false, tone: "text-warning", en: "Can't reach the server", vi: "Không kết nối được máy chủ" },
    off: { icon: Cloud, spin: false, tone: "text-muted", en: "", vi: "" },
  }[status];

  const Icon = view.icon;

  return (
    <button
      onClick={() => void (status === "not_set_up" ? retrySync() : syncNow())}
      className={`flex items-center gap-1.5 text-[11px] font-semibold ${view.tone} ${className}`}
      aria-label={`${view.en}. Tap to sync now.`}
    >
      <Icon size={13} className={view.spin ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{view.en}</span>
      <span className="sm:hidden">{view.vi}</span>
    </button>
  );
}
