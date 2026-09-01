"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/RoleContext";
import { getSettings, updateSettings } from "@/lib/repo/settings";
import { CURRENT_VERSION } from "@/lib/changelog";
import type { AppSettings } from "@/lib/types";

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-14 h-8 rounded-full shrink-0 transition-colors relative ${on ? "bg-brand" : "bg-border"}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SettingsContent() {
  const { session } = useSession();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  if (!session) return null;

  if (session.role !== "owner") {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="pb-6">
      <PageHeader title="Settings · Cài Đặt" subtitle="Owner only · Chỉ chủ nhà hàng" />
      <div className="px-4 md:px-8">
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Manager sees cost & margin</p>
            <p className="text-xs text-muted mt-1">
              Quản lý xem chi phí & lợi nhuận
            </p>
            <p className="text-xs text-muted mt-2">
              When on, Managers can see recipe cost-per-portion and margin figures. Off by default.
            </p>
          </div>
          <Toggle
            on={settings.managerSeesCostMargin}
            onChange={(next) => {
              updateSettings({ managerSeesCostMargin: next });
              setSettings(getSettings());
            }}
          />
        </Card>
        <Link href="/changelog" className="block text-center text-xs text-muted mt-4">
          App version v{CURRENT_VERSION} · What&apos;s new · Có gì mới
        </Link>
      </div>
      <div className="px-4 md:px-8 mt-3">
        <Link
          href="/settings/payments"
          className="w-full min-h-16 bg-surface border border-border rounded-2xl px-4 flex items-center justify-between active:bg-brand-light mb-3"
        >
          <span>
            <span className="block font-semibold text-sm">Bank transfers</span>
            <span className="block text-xs text-muted">
              Chuyển khoản — the account VietQR pays into
            </span>
          </span>
          <ChevronRight size={18} className="text-muted shrink-0" />
        </Link>
        <Link
          href="/settings/receipt"
          className="w-full min-h-16 bg-surface border border-border rounded-2xl px-4 flex items-center justify-between active:bg-brand-light mb-3"
        >
          <span>
            <span className="block font-semibold text-sm">Receipt setup</span>
            <span className="block text-xs text-muted">
              Thiết lập hoá đơn — what prints on the bill
            </span>
          </span>
          <ChevronRight size={18} className="text-muted shrink-0" />
        </Link>
        <Link
          href="/settings/zalo"
          className="w-full min-h-16 bg-surface border border-border rounded-2xl px-4 flex items-center justify-between active:bg-brand-light"
        >
          <span>
            <span className="block font-semibold text-sm">Zalo connection</span>
            <span className="block text-xs text-muted">
              Kết nối Zalo — what the Official Account can send
            </span>
          </span>
          <ChevronRight size={18} className="text-muted shrink-0" />
        </Link>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
