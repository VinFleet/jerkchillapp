import type { PlatformStats, BadgeRequirement } from "@/lib/types";

// Stats start blank — never guessed. Badge requirements are a generic
// starting checklist modeled on how these programs typically work (rating
// threshold, low cancellations, fast confirmation, full photo coverage) —
// phrased as editable defaults since exact current thresholds should be
// confirmed against each platform's own current policy, not assumed.

export const SEED_PLATFORM_STATS: PlatformStats[] = [
  { platform: "grab", rating: null, cancellationRatePct: null, avgConfirmationTimeSec: null, photoCoveragePct: null, commissionPct: null, updatedAt: new Date(0).toISOString() },
  { platform: "shopeefood", rating: null, cancellationRatePct: null, avgConfirmationTimeSec: null, photoCoveragePct: null, commissionPct: null, updatedAt: new Date(0).toISOString() },
];

export const SEED_BADGE_REQUIREMENTS: BadgeRequirement[] = [
  { id: "badge_grab_rating", platform: "grab", requirement: { en: "Rating at or above platform threshold (check current value in-app)", vi: "Đánh giá đạt mức yêu cầu (kiểm tra mức hiện tại trong app)" }, met: false },
  { id: "badge_grab_cancel", platform: "grab", requirement: { en: "Cancellation rate below platform threshold", vi: "Tỷ lệ hủy đơn dưới mức yêu cầu" }, met: false },
  { id: "badge_grab_confirm", platform: "grab", requirement: { en: "Orders confirmed quickly and consistently", vi: "Xác nhận đơn nhanh và ổn định" }, met: false },
  { id: "badge_grab_photos", platform: "grab", requirement: { en: "All menu items have photos", vi: "Tất cả món trong menu có ảnh" }, met: false },
  { id: "badge_shopee_rating", platform: "shopeefood", requirement: { en: "Rating at or above platform threshold (check current value in-app)", vi: "Đánh giá đạt mức yêu cầu (kiểm tra mức hiện tại trong app)" }, met: false },
  { id: "badge_shopee_cancel", platform: "shopeefood", requirement: { en: "Cancellation rate below platform threshold", vi: "Tỷ lệ hủy đơn dưới mức yêu cầu" }, met: false },
  { id: "badge_shopee_confirm", platform: "shopeefood", requirement: { en: "Orders confirmed quickly and consistently", vi: "Xác nhận đơn nhanh và ổn định" }, met: false },
  { id: "badge_shopee_photos", platform: "shopeefood", requirement: { en: "All menu items have photos", vi: "Tất cả món trong menu có ảnh" }, met: false },
];
