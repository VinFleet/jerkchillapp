import type { ContentPillar, KocPlatform, KocTier, KocContactStatus, CampaignPlatform, CampaignStatus, Bi } from "@/lib/types";

export const PILLAR_LABEL: Record<ContentPillar, Bi> = {
  process_sensory: { en: "Process / Sensory", vi: "Quy Trình / Cảm Giác" },
  interior_vibe: { en: "Interior / Vibe", vi: "Không Gian / Chất Riêng" },
  roast_sunday: { en: "Roast Sunday", vi: "Roast Sunday" },
  lunch_box: { en: "Lunch Box", vi: "Cơm Hộp Trưa" },
};

export const PILLAR_ORDER: ContentPillar[] = ["process_sensory", "interior_vibe", "roast_sunday", "lunch_box"];

export const KOC_PLATFORM_LABEL: Record<KocPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  other: "Other",
};

export const KOC_TIER_LABEL: Record<KocTier, Bi> = {
  nano: { en: "Nano", vi: "Nano" },
  micro: { en: "Micro", vi: "Micro" },
  mid: { en: "Mid-tier", vi: "Tầm trung" },
};

export const KOC_STATUS_LABEL: Record<KocContactStatus, Bi> = {
  identified: { en: "Identified", vi: "Đã xác định" },
  contacted: { en: "Contacted", vi: "Đã liên hệ" },
  confirmed: { en: "Confirmed", vi: "Đã xác nhận" },
  posted: { en: "Posted", vi: "Đã đăng" },
  declined: { en: "Declined", vi: "Từ chối" },
};

export const KOC_STATUS_ORDER: KocContactStatus[] = ["identified", "contacted", "confirmed", "posted", "declined"];

export const CAMPAIGN_PLATFORM_LABEL: Record<CampaignPlatform, string> = {
  grab: "Grab",
  shopeefood: "ShopeeFood",
  other: "Other",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, Bi> = {
  upcoming: { en: "Upcoming", vi: "Sắp tới" },
  entered: { en: "Entered", vi: "Đã đăng ký" },
  missed: { en: "Missed", vi: "Đã bỏ lỡ" },
  completed: { en: "Completed", vi: "Hoàn tất" },
};

export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = ["upcoming", "entered", "missed", "completed"];
