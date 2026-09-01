import type { PlatformStats, BadgeRequirement, DeliveryPlatformId } from "@/lib/types";
import { readList, writeList, isSeeded, markSeeded, isLegacyTenant } from "@/lib/storage";
import { SEED_PLATFORM_STATS, SEED_BADGE_REQUIREMENTS } from "@/lib/seed/deliveryPerformance";

const STATS_KEY = "delivery_platform_stats";
const BADGES_KEY = "delivery_badge_requirements";

export function ensureDeliveryPerformanceSeeded() {
  // Jerk & Chill's data belongs to Jerk & Chill. A neutral branch starts
  // empty here and its owner builds their own — the seed below is customer
  // number one's restaurant, not a template.
  if (!isLegacyTenant()) {
    markSeeded(BADGES_KEY);
    markSeeded(STATS_KEY);
    return;
  }

  if (!isSeeded(STATS_KEY)) {
    writeList(STATS_KEY, SEED_PLATFORM_STATS);
    markSeeded(STATS_KEY);
  }
  if (!isSeeded(BADGES_KEY)) {
    writeList(BADGES_KEY, SEED_BADGE_REQUIREMENTS);
    markSeeded(BADGES_KEY);
  }
}

export function getAllPlatformStats(): PlatformStats[] {
  return readList<PlatformStats>(STATS_KEY);
}

export function getPlatformStats(platform: DeliveryPlatformId): PlatformStats | undefined {
  return getAllPlatformStats().find((p) => p.platform === platform);
}

export function updatePlatformStats(platform: DeliveryPlatformId, patch: Partial<Omit<PlatformStats, "platform">>) {
  const all = getAllPlatformStats();
  const idx = all.findIndex((p) => p.platform === platform);
  const updated: PlatformStats = {
    platform,
    rating: null,
    cancellationRatePct: null,
    avgConfirmationTimeSec: null,
    photoCoveragePct: null,
    commissionPct: null,
    ...(idx >= 0 ? all[idx] : {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  writeList(STATS_KEY, all);
}

/**
 * Seeded rows carry the epoch as a "never entered" marker, so a 1970 timestamp
 * is not a real reading — these stats are hand-entered, and a stale number
 * looks identical to a fresh one unless the date is shown next to it.
 */
export function getStatsUpdatedAt(stats: PlatformStats): string | null {
  const t = new Date(stats.updatedAt).getTime();
  return Number.isFinite(t) && t > 0 ? stats.updatedAt : null;
}

export function getBadgeRequirements(platform: DeliveryPlatformId): BadgeRequirement[] {
  return readList<BadgeRequirement>(BADGES_KEY).filter((b) => b.platform === platform);
}

export function toggleBadgeRequirement(id: string) {
  const all = readList<BadgeRequirement>(BADGES_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], met: !all[idx].met };
  writeList(BADGES_KEY, all);
}

export function getBlockersCount(platform: DeliveryPlatformId): number {
  return getBadgeRequirements(platform).filter((b) => !b.met).length;
}
