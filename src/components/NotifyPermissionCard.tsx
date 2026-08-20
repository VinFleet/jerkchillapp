"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from "@/lib/notify/device";

/**
 * Turning device notifications on has to be a deliberate tap — browsers
 * require a user gesture, and a permission prompt fired on page load is the
 * one people reflexively deny.
 */
export function NotifyPermissionCard() {
  const [permission, setPermission] = useState<NotifyPermission>("unsupported");

  useEffect(() => setPermission(notifyPermission()), []);

  if (permission === "unsupported") return null;

  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3">
        {permission === "granted" ? (
          <Bell size={20} className="text-success shrink-0 mt-0.5" />
        ) : (
          <BellOff size={20} className="text-muted shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Alerts on this device · Cảnh báo trên thiết bị này</p>
          <p className="text-xs text-muted mt-0.5">
            Urgent notices buzz this device even when the app is behind something else.
            <br />
            Thông báo khẩn sẽ báo trên thiết bị này ngay cả khi ứng dụng đang ẩn.
          </p>

          {permission === "granted" && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-success mt-2">
              <Check size={14} /> On · Đã bật
            </p>
          )}

          {permission === "default" && (
            <Button
              className="min-h-11 text-sm mt-2 px-4"
              onClick={async () => setPermission(await requestNotifyPermission())}
            >
              Turn on alerts · Bật cảnh báo
            </Button>
          )}

          {permission === "denied" && (
            <p className="text-xs text-warning font-semibold mt-2">
              Blocked in the browser — allow notifications for this site in your browser settings, then reload.
              <br />
              Đã bị chặn — hãy cho phép thông báo cho trang này trong cài đặt trình duyệt, rồi tải lại.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
