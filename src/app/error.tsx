"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * The screen a crash lands on — mid-service, on a device whose user did
 * nothing wrong.
 *
 * One job: get them back to work. The reset re-renders in place, and because
 * the app is local-first a reload loses nothing — worth saying out loud,
 * since the person staring at this is holding a till in front of a guest.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-background p-6">
      <div className="text-center max-w-sm space-y-3">
        <AlertTriangle size={40} className="text-warning mx-auto" />
        <p className="font-bold">Something broke on this screen</p>
        <p className="text-sm text-muted">Màn hình này gặp lỗi</p>
        <p className="text-sm text-muted">
          Your orders and records are safe on this device — nothing is lost by trying again.
          <br />
          Dữ liệu vẫn an toàn trên máy — thử lại không mất gì.
        </p>
        <button
          onClick={reset}
          className="min-h-[52px] px-6 rounded-xl bg-brand text-white font-semibold inline-flex items-center gap-2"
        >
          <RotateCcw size={16} /> Try again · Thử lại
        </button>
      </div>
    </div>
  );
}
