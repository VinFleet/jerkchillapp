import type { ContentPost, ContentPillar, KocOutreach, KocPlatform, KocTier, PlatformCampaign, CampaignPlatform } from "@/lib/types";
import { readList, writeList, newId } from "@/lib/storage";

const POSTS_KEY = "content_posts";
const KOC_KEY = "koc_outreach";
const CAMPAIGNS_KEY = "platform_campaigns";

// ---------- Content calendar ----------

export function getContentPosts(): ContentPost[] {
  return readList<ContentPost>(POSTS_KEY).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function addContentPost(date: string, pillar: ContentPillar, title: string): ContentPost {
  const entry: ContentPost = { id: newId("post"), date, pillar, title, status: "planned" };
  const all = readList<ContentPost>(POSTS_KEY);
  all.push(entry);
  writeList(POSTS_KEY, all);
  return entry;
}

export function updateContentPost(id: string, patch: Partial<Omit<ContentPost, "id">>) {
  const all = readList<ContentPost>(POSTS_KEY);
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(POSTS_KEY, all);
}

export function getPillarPerformance(): Record<ContentPillar, { posts: number; saves: number; shares: number }> {
  const base: Record<ContentPillar, { posts: number; saves: number; shares: number }> = {
    process_sensory: { posts: 0, saves: 0, shares: 0 },
    interior_vibe: { posts: 0, saves: 0, shares: 0 },
    roast_sunday: { posts: 0, saves: 0, shares: 0 },
    lunch_box: { posts: 0, saves: 0, shares: 0 },
  };
  for (const post of getContentPosts()) {
    if (post.status !== "posted") continue;
    base[post.pillar].posts += 1;
    base[post.pillar].saves += post.saves ?? 0;
    base[post.pillar].shares += post.shares ?? 0;
  }
  return base;
}

// ---------- KOC / Influencer outreach ----------

export function getKocOutreach(): KocOutreach[] {
  return readList<KocOutreach>(KOC_KEY);
}

export function addKocOutreach(handle: string, platform: KocPlatform, tier: KocTier): KocOutreach {
  const entry: KocOutreach = { id: newId("koc"), handle, platform, tier, status: "identified", wentLive: false };
  const all = readList<KocOutreach>(KOC_KEY);
  all.push(entry);
  writeList(KOC_KEY, all);
  return entry;
}

export function updateKocOutreach(id: string, patch: Partial<Omit<KocOutreach, "id">>) {
  const all = readList<KocOutreach>(KOC_KEY);
  const idx = all.findIndex((k) => k.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(KOC_KEY, all);
}

// ---------- Platform campaigns ----------

export function getPlatformCampaigns(): PlatformCampaign[] {
  return readList<PlatformCampaign>(CAMPAIGNS_KEY);
}

export function addPlatformCampaign(platform: CampaignPlatform, name: string): PlatformCampaign {
  const entry: PlatformCampaign = { id: newId("camp"), platform, name, status: "upcoming" };
  const all = readList<PlatformCampaign>(CAMPAIGNS_KEY);
  all.push(entry);
  writeList(CAMPAIGNS_KEY, all);
  return entry;
}

export function updatePlatformCampaign(id: string, patch: Partial<Omit<PlatformCampaign, "id">>) {
  const all = readList<PlatformCampaign>(CAMPAIGNS_KEY);
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeList(CAMPAIGNS_KEY, all);
}
