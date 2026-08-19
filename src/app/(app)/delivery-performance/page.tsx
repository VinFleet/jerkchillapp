"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  getPlatformStats,
  updatePlatformStats,
  getBadgeRequirements,
  toggleBadgeRequirement,
} from "@/lib/repo/deliveryPerformance";
import type { PlatformStats, BadgeRequirement, DeliveryPlatformId } from "@/lib/types";

const PLATFORM_LABEL: Record<DeliveryPlatformId, string> = {
  grab: "Grab",
  shopeefood: "ShopeeFood",
  other: "Other",
};

const PLATFORMS: DeliveryPlatformId[] = ["grab", "shopeefood"];

function StatField({ label, value, suffix, onSave }: { label: string; value: number | null; suffix: string; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null ? String(value) : "");

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 min-h-10 rounded-lg border-2 border-border px-2 text-sm font-bold text-center"
        />
        <button
          className="text-xs text-brand font-semibold"
          onClick={() => {
            onSave(draft.trim() === "" ? null : Number(draft));
            setEditing(false);
          }}
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-bold text-sm">{value !== null ? `${value}${suffix}` : <span className="text-muted font-normal">Set</span>}</p>
    </button>
  );
}

function PlatformCard({ platform }: { platform: DeliveryPlatformId }) {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [badges, setBadges] = useState<BadgeRequirement[]>([]);

  const refresh = () => {
    setStats(getPlatformStats(platform) ?? null);
    setBadges(getBadgeRequirements(platform));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => refresh(), [platform]);

  if (!stats) return null;
  const blockers = badges.filter((b) => !b.met).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold">{PLATFORM_LABEL[platform]}</p>
        <Badge tone={blockers === 0 ? "success" : "warning"}>
          {blockers === 0 ? "Badge criteria met" : `${blockers} blocking badge status`}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatField label="Rating · Đánh giá" value={stats.rating} suffix="/5" onSave={(v) => { updatePlatformStats(platform, { rating: v }); refresh(); }} />
        <StatField label="Cancellation · Hủy đơn" value={stats.cancellationRatePct} suffix="%" onSave={(v) => { updatePlatformStats(platform, { cancellationRatePct: v }); refresh(); }} />
        <StatField label="Confirm time · Thời gian xác nhận" value={stats.avgConfirmationTimeSec} suffix="s" onSave={(v) => { updatePlatformStats(platform, { avgConfirmationTimeSec: v }); refresh(); }} />
        <StatField label="Photo coverage · Ảnh món" value={stats.photoCoveragePct} suffix="%" onSave={(v) => { updatePlatformStats(platform, { photoCoveragePct: v }); refresh(); }} />
        <StatField label="Commission · Chiết khấu" value={stats.commissionPct} suffix="%" onSave={(v) => { updatePlatformStats(platform, { commissionPct: v }); refresh(); }} />
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Badge requirements · Điều kiện huy hiệu</p>
        {badges.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              toggleBadgeRequirement(b.id);
              refresh();
            }}
            className="w-full flex items-center gap-2 text-left"
          >
            {b.met ? <CheckCircle2 size={18} className="text-success shrink-0" /> : <Circle size={18} className="text-muted shrink-0" />}
            <Bi value={b.requirement} className={`text-sm ${b.met ? "line-through opacity-60" : ""}`} mode="inline" />
          </button>
        ))}
      </div>
    </Card>
  );
}

function DeliveryPerformanceContent() {
  return (
    <div className="pb-6">
      <PageHeader title="Delivery Platforms · Nền Tảng Giao Hàng" subtitle="Performance and badge status · Hiệu suất và huy hiệu" />
      <div className="px-4 md:px-8 space-y-4">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p} platform={p} />
        ))}
      </div>
    </div>
  );
}

export default function DeliveryPerformancePage() {
  return (
    <RoleGate module="deliveryPerformance">
      <DeliveryPerformanceContent />
    </RoleGate>
  );
}
