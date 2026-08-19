"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { onStorageFull, isStorageFull } from "@/lib/storage";

/**
 * A save that fails silently is the worst outcome for legally-required
 * food-safety records — staff would see a normal-looking save and the record
 * would not exist. This banner stays up until a write succeeds again.
 */
export function StorageFullBanner() {
  const [full, setFull] = useState(false);

  useEffect(() => {
    setFull(isStorageFull());
    return onStorageFull(setFull);
  }, []);

  if (!full) return null;

  return (
    <div className="print:hidden sticky top-0 z-30 bg-danger text-white px-4 py-3 flex items-start gap-2">
      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
      <div className="text-sm leading-snug">
        <p className="font-semibold">This device&apos;s storage is full — your last entry was NOT saved.</p>
        <p className="opacity-90">Bộ nhớ thiết bị đã đầy — mục vừa nhập CHƯA được lưu.</p>
        <p className="opacity-90 mt-1 text-xs">
          Export and clear old records, or use another device. Tell the manager now.
          <br />
          Xuất và xóa dữ liệu cũ, hoặc dùng thiết bị khác. Báo quản lý ngay.
        </p>
      </div>
    </div>
  );
}
