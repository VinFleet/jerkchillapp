"use client";

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
  const { status, pendingCount, syncNow } = useSync();

  if (status === "off") return null;

  const view = {
    syncing: { icon: RefreshCw, spin: true, tone: "text-muted", en: "Syncing…", vi: "Đang đồng bộ…" },
    synced: { icon: Check, spin: false, tone: "text-success", en: "Up to date", vi: "Đã cập nhật" },
    not_set_up: { icon: Cloud, spin: false, tone: "text-muted", en: "This device only", vi: "Chỉ thiết bị này" },
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
