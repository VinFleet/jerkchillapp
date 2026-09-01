"use client";

import Link from "next/link";
import { Settings, Sparkles, BellRing } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { useSession } from "@/lib/auth/RoleContext";
import { canAccessModule } from "@/lib/auth/permissions";
import { NAV_ITEMS, MOBILE_PRIMARY_MODULES } from "@/lib/nav";
import { CURRENT_VERSION } from "@/lib/changelog";

export default function MorePage() {
  const { session } = useSession();
  if (!session) return null;

  const items = NAV_ITEMS.filter(
    (item) =>
      item.module !== "home" &&
      !MOBILE_PRIMARY_MODULES.includes(item.module) &&
      canAccessModule(session.role, item.module)
  );

  return (
    <div className="pb-6">
      <PageHeader title="More · Thêm" subtitle="Everything else · Các mục khác" />
      <div className="px-4 md:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="min-h-24 bg-surface border border-border rounded-2xl p-4 flex flex-col items-start justify-between active:bg-brand-light transition-colors"
              >
                <Icon size={24} className="text-brand" />
                <Bi value={item.label} className="text-sm font-semibold mt-2" />
              </Link>
            );
          })}
          <Link
            href="/settings/notifications"
            className="min-h-24 bg-surface border border-border rounded-2xl p-4 flex flex-col items-start justify-between active:bg-brand-light transition-colors"
          >
            <BellRing size={24} className="text-brand" />
            <Bi value={{ en: "Alerts", vi: "Thông báo" }} className="text-sm font-semibold mt-2" />
          </Link>
          {(session.role === "owner" || session.role === "manager") && (
            <Link
              href="/settings"
              className="min-h-24 bg-surface border border-border rounded-2xl p-4 flex flex-col items-start justify-between active:bg-brand-light transition-colors"
            >
              <Settings size={24} className="text-brand" />
              <Bi value={{ en: "Settings", vi: "Cài đặt" }} className="text-sm font-semibold mt-2" />
            </Link>
          )}
          <Link
            href="/changelog"
            className="min-h-24 bg-surface border border-border rounded-2xl p-4 flex flex-col items-start justify-between active:bg-brand-light transition-colors"
          >
            <Sparkles size={24} className="text-brand" />
            <div>
              <Bi value={{ en: "What's New", vi: "Có Gì Mới" }} className="text-sm font-semibold" />
              <p className="text-xs text-muted mt-0.5">v{CURRENT_VERSION}</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
