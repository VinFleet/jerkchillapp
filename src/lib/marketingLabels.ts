import type { ContentPillar, KocPlatform, KocTier, KocContactStatus, CampaignPlatform, CampaignStatus, Bi } from "@/lib/types";

export const PILLAR_LABEL: Record<ContentPillar, Bi> = {
  process_sensory: { en: "Process / Sensory", vi: "Quy Trình / Cảm Giác" },
  interior_vibe: { en: "Interior / Vibe", vi: "Không Gian / Chất Riêng" },
  roast_sunday: { en: "Roast Sunday", vi: "Roast Sunday" },
  lunch_box: { en: "Lunch Box", vi: "Cơm Hộp Trưa" },
};

export const PILLAR_ORDER: ContentPillar[] = ["process_sensory", "interior_vibe", "roast_sunday", "lunch_box"];

/** Platform names are brand names, so they read the same in both languages — only the catch-all needs a Vietnamese half. */
export const KOC_PLATFORM_LABEL: Record<KocPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  other: "Other · Khác",
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
  other: "Other · Khác",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, Bi> = {
  upcoming: { en: "Upcoming", vi: "Sắp tới" },
  entered: { en: "Entered", vi: "Đã đăng ký" },
  missed: { en: "Missed", vi: "Đã bỏ lỡ" },
  completed: { en: "Completed", vi: "Hoàn tất" },
};

export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = ["upcoming", "entered", "missed", "completed"];

/** Where today sits relative to a campaign's entry window — a window that quietly closes is a missed campaign. */
export type CampaignWindowState = "none" | "upcoming" | "open" | "closing_soon" | "closed";

export const CAMPAIGN_WINDOW_LABEL: Record<CampaignWindowState, Bi> = {
  none: { en: "No entry window set", vi: "Chưa đặt cửa sổ đăng ký" },
  upcoming: { en: "Window not open yet", vi: "Chưa mở đăng ký" },
  open: { en: "Window open", vi: "Đang mở đăng ký" },
  closing_soon: { en: "Window closing soon", vi: "Sắp hết hạn đăng ký" },
  closed: { en: "Window closed", vi: "Đã hết hạn đăng ký" },
};
