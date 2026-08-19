"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  getAllPlatformStats,
  updatePlatformStats,
  getStatsUpdatedAt,
  getBadgeRequirements,
  toggleBadgeRequirement,
} from "@/lib/repo/deliveryPerformance";
import type { PlatformStats, BadgeRequirement, DeliveryPlatformId, Bi as BiValue } from "@/lib/types";

const PLATFORM_LABEL: Record<DeliveryPlatformId, string> = {
  grab: "Grab",
  shopeefood: "ShopeeFood",
  other: "Other · Khác",
};

const PLATFORMS: DeliveryPlatformId[] = ["grab", "shopeefood"];

/** Anything older than this is worth a second look before a decision is made on it. */
const STALE_AFTER_DAYS = 30;

/** The stats that mean the same thing on every platform, so they can be read side by side. Commission is the one the spec asks for by name. */
const COMPARABLE_STATS: { label: BiValue; suffix: string; better: "lower" | "higher"; get: (s: PlatformStats) => number | null }[] = [
  { label: { en: "Commission", vi: "Chiết khấu" }, suffix: "%", better: "lower", get: (s) => s.commissionPct },
  { label: { en: "Rating", vi: "Đánh giá" }, suffix: "/5", better: "higher", get: (s) => s.rating },
  { label: { en: "Cancellation", vi: "Hủy đơn" }, suffix: "%", better: "lower", get: (s) => s.cancellationRatePct },
  { label: { en: "Confirm time", vi: "Xác nhận" }, suffix: "s", better: "lower", get: (s) => s.avgConfirmationTimeSec },
  { label: { en: "Photo coverage", vi: "Ảnh món" }, suffix: "%", better: "higher", get: (s) => s.photoCoveragePct },
];

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** When a hand-entered number was last touched — the difference between a current figure and a forgotten one. */
function UpdatedStamp({ stats, className = "" }: { stats: PlatformStats; className?: string }) {
  const updatedAt = getStatsUpdatedAt(stats);

  if (!updatedAt) {
    return <span className={`text-warning font-semibold ${className}`}>Never entered · Chưa nhập</span>;
  }

  const days = daysSince(updatedAt);
  const stale = days >= STALE_AFTER_DAYS;
  return (
    <span className={`${stale ? "text-warning font-semibold" : "text-muted"} ${className}`}>
      {new Date(updatedAt).toLocaleDateString()} · {days === 0 ? "today · hôm nay" : `${days}d ago · ${days} ngày trước`}
    </span>
  );
}

/** Commission and the other like-for-like stats in one place, so the platforms are actually comparable instead of two stacked cards. */
function PlatformComparison({ stats }: { stats: PlatformStats[] }) {
  const rows = PLATFORMS.map((p) => stats.find((s) => s.platform === p));
  if (rows.some((s) => s === undefined)) return null;
  const present = rows as PlatformStats[];

  return (
    <Card className="p-0">
      <div className="px-4 py-3 border-b border-border">
        <p className="font-bold text-sm">Side by side · So sánh trực tiếp</p>
        <p className="text-xs text-muted">Commission and like-for-like stats · Chiết khấu và các chỉ số so sánh được</p>
      </div>
      <div className="px-4 py-2 grid grid-cols-[1.4fr_1fr_1fr] gap-2 text-xs text-muted font-semibold border-b border-border">
        <span>Stat · Chỉ số</span>
        {PLATFORMS.map((p) => (
          <span key={p} className="text-center">
            {PLATFORM_LABEL[p]}
          </span>
        ))}
      </div>
      {COMPARABLE_STATS.map((row) => {
        const values = present.map((s) => row.get(s));
        const comparable = values.filter((v): v is number => v !== null);
        const best =
          comparable.length === present.length && new Set(comparable).size > 1
            ? row.better === "lower"
              ? Math.min(...comparable)
              : Math.max(...comparable)
            : null;

        return (
          <div key={row.label.en} className="px-4 py-2 grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center border-b border-border last:border-b-0">
            <Bi value={row.label} className="text-xs text-muted" mode="inline" />
            {values.map((v, i) => (
              <span
                key={PLATFORMS[i]}
                className={`text-center text-sm tabular-nums ${v !== null && v === best ? "text-success font-bold" : "font-semibold"}`}
              >
                {v !== null ? `${v}${row.suffix}` : <span className="text-muted font-normal">—</span>}
              </span>
            ))}
          </div>
        );
      })}
      <div className="px-4 py-2 grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center border-t border-border">
        <span className="text-xs text-muted flex items-center gap-1">
          <Clock size={12} className="shrink-0" /> Updated · Cập nhật
        </span>
        {present.map((s) => (
          <UpdatedStamp key={s.platform} stats={s} className="text-[11px] text-center" />
        ))}
      </div>
    </Card>
  );
}

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
          className="w-20 min-h-11 rounded-lg border-2 border-border px-2 text-sm font-bold text-center"
        />
        <button
          className="min-h-11 px-2 text-xs text-brand font-semibold"
          onClick={() => {
            onSave(draft.trim() === "" ? null : Number(draft));
            setEditing(false);
          }}
        >
          Save · Lưu
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left min-h-11">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-bold text-sm">{value !== null ? `${value}${suffix}` : <span className="text-muted font-normal">Set · Nhập</span>}</p>
    </button>
  );
}

function PlatformCard({ platform, stats, onChanged }: { platform: DeliveryPlatformId; stats: PlatformStats | undefined; onChanged: () => void }) {
  const [badges, setBadges] = useState<BadgeRequirement[]>([]);

  const refreshBadges = () => setBadges(getBadgeRequirements(platform));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => refreshBadges(), [platform]);

  if (!stats) return null;
  const blockers = badges.filter((b) => !b.met).length;
  const save = (patch: Partial<Omit<PlatformStats, "platform">>) => {
    updatePlatformStats(platform, patch);
    onChanged();
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-bold">{PLATFORM_LABEL[platform]}</p>
        <Badge tone={blockers === 0 ? "success" : "warning"} className="whitespace-normal text-left">
          {blockers === 0 ? "Badge criteria met · Đạt điều kiện huy hiệu" : `${blockers} blocking badge status · ${blockers} điều kiện chưa đạt`}
        </Badge>
      </div>
      <p className="text-xs mb-3">
        <span className="text-muted">Updated · Cập nhật: </span>
        <UpdatedStamp stats={stats} />
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatField label="Rating · Đánh giá" value={stats.rating} suffix="/5" onSave={(v) => save({ rating: v })} />
        <StatField label="Cancellation · Hủy đơn" value={stats.cancellationRatePct} suffix="%" onSave={(v) => save({ cancellationRatePct: v })} />
        <StatField label="Confirm time · Thời gian xác nhận" value={stats.avgConfirmationTimeSec} suffix="s" onSave={(v) => save({ avgConfirmationTimeSec: v })} />
        <StatField label="Photo coverage · Ảnh món" value={stats.photoCoveragePct} suffix="%" onSave={(v) => save({ photoCoveragePct: v })} />
        <StatField label="Commission · Chiết khấu" value={stats.commissionPct} suffix="%" onSave={(v) => save({ commissionPct: v })} />
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Badge requirements · Điều kiện huy hiệu</p>
        {badges.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              toggleBadgeRequirement(b.id);
              refreshBadges();
            }}
            className="w-full min-h-11 flex items-center gap-2 text-left"
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
  const [stats, setStats] = useState<PlatformStats[]>([]);
  const refresh = () => setStats(getAllPlatformStats());
  useEffect(() => refresh(), []);

  return (
    <div className="pb-6">
      <PageHeader title="Delivery Platforms · Nền Tảng Giao Hàng" subtitle="Performance and badge status · Hiệu suất và huy hiệu" />
      <div className="px-4 md:px-8 space-y-4">
        <PlatformComparison stats={stats} />
        {PLATFORMS.map((p) => (
          <PlatformCard key={p} platform={p} stats={stats.find((s) => s.platform === p)} onChanged={refresh} />
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
