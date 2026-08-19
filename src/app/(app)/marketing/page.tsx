"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditMarketing } from "@/lib/auth/permissions";
import {
  getContentPosts,
  addContentPost,
  updateContentPost,
  getPillarPerformance,
  getKocOutreach,
  addKocOutreach,
  updateKocOutreach,
  getPlatformCampaigns,
  addPlatformCampaign,
  updatePlatformCampaign,
} from "@/lib/repo/marketing";
import {
  PILLAR_LABEL,
  PILLAR_ORDER,
  KOC_PLATFORM_LABEL,
  KOC_TIER_LABEL,
  KOC_STATUS_LABEL,
  KOC_STATUS_ORDER,
  CAMPAIGN_PLATFORM_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_ORDER,
} from "@/lib/marketingLabels";
import { todayIso } from "@/lib/storage";
import type {
  ContentPost,
  ContentPillar,
  KocOutreach,
  KocPlatform,
  KocTier,
  PlatformCampaign,
  CampaignPlatform,
} from "@/lib/types";

type Tab = "calendar" | "koc" | "campaigns" | "performance";

// ---------- Calendar ----------

function AddPostForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [pillar, setPillar] = useState<ContentPillar>("process_sensory");
  const [title, setTitle] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Plan a post · Lên kế hoạch bài đăng
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New post · Bài đăng mới</p>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm" />
      <select
        value={pillar}
        onChange={(e) => setPillar(e.target.value as ContentPillar)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm bg-surface"
      >
        {PILLAR_ORDER.map((p) => (
          <option key={p} value={p}>
            {PILLAR_LABEL[p].en} · {PILLAR_LABEL[p].vi}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title / idea · Tiêu đề / ý tưởng"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!title.trim()}
          onClick={() => {
            addContentPost(date, pillar, title.trim());
            setTitle("");
            setOpen(false);
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function PostCard({ post, onChanged }: { post: ContentPost; onChanged: () => void }) {
  const [saves, setSaves] = useState(String(post.saves ?? ""));
  const [shares, setShares] = useState(String(post.shares ?? ""));

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-semibold text-sm">{post.title}</p>
        <Badge tone={post.status === "posted" ? "success" : "muted"}>{post.status === "posted" ? "Posted" : "Planned"}</Badge>
      </div>
      <p className="text-xs text-muted mb-2">
        {post.date} · <Bi value={PILLAR_LABEL[post.pillar]} mode="inline" />
      </p>
      {post.status === "planned" ? (
        <Button
          variant="secondary"
          className="min-h-10 text-sm"
          onClick={() => {
            updateContentPost(post.id, { status: "posted" });
            onChanged();
          }}
        >
          Mark posted · Đánh dấu đã đăng
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={saves}
            onChange={(e) => setSaves(e.target.value)}
            onBlur={() => updateContentPost(post.id, { saves: Number(saves) || 0 })}
            placeholder="Saves"
            className="w-20 min-h-10 rounded-lg border-2 border-border px-2 text-sm text-center"
          />
          <input
            type="number"
            inputMode="numeric"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            onBlur={() => updateContentPost(post.id, { shares: Number(shares) || 0 })}
            placeholder="Shares"
            className="w-20 min-h-10 rounded-lg border-2 border-border px-2 text-sm text-center"
          />
        </div>
      )}
    </Card>
  );
}

function CalendarTab({ canEdit }: { canEdit: boolean }) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const refresh = () => setPosts(getContentPosts());
  useEffect(() => refresh(), []);

  return (
    <div>
      {canEdit && <AddPostForm onAdded={refresh} />}
      <div className="space-y-2">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onChanged={refresh} />
        ))}
        {posts.length === 0 && <p className="text-muted text-center py-10 text-sm">No posts planned yet · Chưa có bài đăng nào</p>}
      </div>
    </div>
  );
}

// ---------- KOC outreach ----------

function AddKocForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<KocPlatform>("instagram");
  const [tier, setTier] = useState<KocTier>("nano");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add KOC/influencer · Thêm KOC
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New outreach · Liên hệ mới</p>
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="Handle · Tên tài khoản (e.g. @foodie_hcmc)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm"
      />
      <div className="flex gap-2 mb-2">
        {(["instagram", "tiktok", "facebook", "other"] as KocPlatform[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`flex-1 min-h-10 rounded-full text-xs font-semibold border-2 ${
              platform === p ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {KOC_PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        {(["nano", "micro", "mid"] as KocTier[]).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 min-h-10 rounded-full text-xs font-semibold border-2 ${
              tier === t ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {KOC_TIER_LABEL[t].en}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!handle.trim()}
          onClick={() => {
            addKocOutreach(handle.trim(), platform, tier);
            setHandle("");
            setOpen(false);
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function KocTab({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<KocOutreach[]>([]);
  const refresh = () => setItems(getKocOutreach());
  useEffect(() => refresh(), []);

  return (
    <div>
      {canEdit && <AddKocForm onAdded={refresh} />}
      <div className="space-y-2">
        {items.map((k) => (
          <Card key={k.id}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-sm">{k.handle}</p>
                <p className="text-xs text-muted">
                  {KOC_PLATFORM_LABEL[k.platform]} · <Bi value={KOC_TIER_LABEL[k.tier]} mode="inline" />
                </p>
              </div>
              {k.wentLive && <Badge tone="success">Live</Badge>}
            </div>
            <div className="flex flex-wrap gap-1">
              {KOC_STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    updateKocOutreach(k.id, { status: s });
                    refresh();
                  }}
                  className={`min-h-8 px-2 rounded-full text-[11px] font-semibold border-2 ${
                    k.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
                  }`}
                >
                  {KOC_STATUS_LABEL[s].en}
                </button>
              ))}
            </div>
            {!k.wentLive && k.status === "posted" && (
              <button
                className="mt-2 text-xs text-brand font-semibold"
                onClick={() => {
                  updateKocOutreach(k.id, { wentLive: true });
                  refresh();
                }}
              >
                Mark went live · Đánh dấu đã lên bài
              </button>
            )}
          </Card>
        ))}
        {items.length === 0 && <p className="text-muted text-center py-10 text-sm">No outreach yet · Chưa có liên hệ nào</p>}
      </div>
    </div>
  );
}

// ---------- Platform campaigns ----------

function AddCampaignForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<CampaignPlatform>("grab");
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add campaign · Thêm chiến dịch
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New campaign · Chiến dịch mới</p>
      <div className="flex gap-2 mb-2">
        {(["grab", "shopeefood", "other"] as CampaignPlatform[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`flex-1 min-h-10 rounded-full text-xs font-semibold border-2 ${
              platform === p ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {CAMPAIGN_PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Campaign name · Tên chiến dịch"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            addPlatformCampaign(platform, name.trim());
            setName("");
            setOpen(false);
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function CampaignsTab({ canEdit }: { canEdit: boolean }) {
  const [campaigns, setCampaigns] = useState<PlatformCampaign[]>([]);
  const refresh = () => setCampaigns(getPlatformCampaigns());
  useEffect(() => refresh(), []);

  return (
    <div>
      {canEdit && <AddCampaignForm onAdded={refresh} />}
      <div className="space-y-2">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <p className="font-semibold text-sm">{c.name}</p>
            <p className="text-xs text-muted mb-2">{CAMPAIGN_PLATFORM_LABEL[c.platform]}</p>
            <div className="flex flex-wrap gap-1">
              {CAMPAIGN_STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    updatePlatformCampaign(c.id, { status: s });
                    refresh();
                  }}
                  className={`min-h-8 px-2 rounded-full text-[11px] font-semibold border-2 ${
                    c.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
                  }`}
                >
                  {CAMPAIGN_STATUS_LABEL[s].en}
                </button>
              ))}
            </div>
          </Card>
        ))}
        {campaigns.length === 0 && <p className="text-muted text-center py-10 text-sm">No campaigns yet · Chưa có chiến dịch nào</p>}
      </div>
    </div>
  );
}

// ---------- Performance ----------

function PerformanceTab() {
  const perf = getPillarPerformance();
  return (
    <Card className="p-0 divide-y divide-border">
      <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-muted font-semibold">
        <span>Pillar</span>
        <span className="text-center">Posts</span>
        <span className="text-center">Saves</span>
        <span className="text-center">Shares</span>
      </div>
      {PILLAR_ORDER.map((p) => (
        <div key={p} className="grid grid-cols-4 gap-2 px-4 py-3 items-center">
          <Bi value={PILLAR_LABEL[p]} className="text-sm" mode="inline" />
          <span className="text-center tabular-nums text-sm">{perf[p].posts}</span>
          <span className="text-center tabular-nums text-sm">{perf[p].saves}</span>
          <span className="text-center tabular-nums text-sm">{perf[p].shares}</span>
        </div>
      ))}
    </Card>
  );
}

function MarketingContent() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("calendar");

  if (!session) return null;
  const canEdit = canEditMarketing(session.role);

  return (
    <div className="pb-6">
      <PageHeader title="Marketing Calendar · Lịch Marketing" subtitle="Content, KOC, campaigns · Nội dung, KOC, chiến dịch" />
      <div className="px-4 md:px-8">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            ["calendar", "Calendar · Lịch"],
            ["koc", "KOC Outreach"],
            ["campaigns", "Campaigns · Chiến dịch"],
            ["performance", "Performance · Hiệu quả"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 px-4 rounded-full font-semibold text-sm border-2 shrink-0 ${
                tab === t ? "bg-brand text-white border-brand" : "border-border text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "calendar" && <CalendarTab canEdit={canEdit} />}
        {tab === "koc" && <KocTab canEdit={canEdit} />}
        {tab === "campaigns" && <CampaignsTab canEdit={canEdit} />}
        {tab === "performance" && <PerformanceTab />}
      </div>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <RoleGate module="marketing">
      <MarketingContent />
    </RoleGate>
  );
}
