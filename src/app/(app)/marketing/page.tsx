"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, CalendarClock } from "lucide-react";
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
  getCampaignWindowState,
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
  CAMPAIGN_WINDOW_LABEL,
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

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

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
          Cancel · Hủy
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
        <Badge tone={post.status === "posted" ? "success" : "muted"}>
          {post.status === "posted" ? "Posted · Đã đăng" : "Planned · Đã lên lịch"}
        </Badge>
      </div>
      <p className="text-xs text-muted mb-2">
        {post.date} · <Bi value={PILLAR_LABEL[post.pillar]} mode="inline" />
      </p>
      {post.status === "planned" ? (
        <Button
          variant="secondary"
          className="min-h-11 text-sm"
          onClick={() => {
            updateContentPost(post.id, { status: "posted" });
            onChanged();
          }}
        >
          Mark posted · Đánh dấu đã đăng
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="block text-xs text-muted mb-1">Saves · Lượt lưu</span>
            <input
              type="number"
              inputMode="numeric"
              value={saves}
              onChange={(e) => setSaves(e.target.value)}
              onBlur={() => updateContentPost(post.id, { saves: Number(saves) || 0 })}
              className="w-full min-h-11 rounded-lg border-2 border-border px-2 text-sm text-center tabular-nums"
            />
          </label>
          <label className="flex-1">
            <span className="block text-xs text-muted mb-1">Shares · Lượt chia sẻ</span>
            <input
              type="number"
              inputMode="numeric"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              onBlur={() => updateContentPost(post.id, { shares: Number(shares) || 0 })}
              className="w-full min-h-11 rounded-lg border-2 border-border px-2 text-sm text-center tabular-nums"
            />
          </label>
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
  const [compedCost, setCompedCost] = useState("");
  const [notes, setNotes] = useState("");

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
            className={`flex-1 min-h-11 rounded-full text-xs font-semibold border-2 ${
              platform === p ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {KOC_PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-2">
        {(["nano", "micro", "mid"] as KocTier[]).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 min-h-11 rounded-full text-xs font-semibold border-2 ${
              tier === t ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {KOC_TIER_LABEL[t].en} · {KOC_TIER_LABEL[t].vi}
          </button>
        ))}
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={compedCost}
        onChange={(e) => setCompedCost(e.target.value)}
        placeholder="Comped meal cost VND · Chi phí bữa ăn mời (VND)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes · Ghi chú"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!handle.trim()}
          onClick={() => {
            addKocOutreach(
              handle.trim(),
              platform,
              tier,
              compedCost.trim() === "" ? undefined : Number(compedCost),
              notes.trim() || undefined,
            );
            setHandle("");
            setCompedCost("");
            setNotes("");
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

/** Comped meal cost and notes are usually only known after the visit, so they stay editable on the card, not just at creation. */
function EditKocForm({ item, onDone }: { item: KocOutreach; onDone: () => void }) {
  const [compedCost, setCompedCost] = useState(item.compedMealCostVnd !== undefined ? String(item.compedMealCostVnd) : "");
  const [notes, setNotes] = useState(item.notes ?? "");

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <input
        type="number"
        inputMode="numeric"
        value={compedCost}
        onChange={(e) => setCompedCost(e.target.value)}
        placeholder="Comped meal cost VND · Chi phí bữa ăn mời (VND)"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes · Ghi chú"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={onDone}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-11 text-sm"
          onClick={() => {
            updateKocOutreach(item.id, {
              compedMealCostVnd: compedCost.trim() === "" ? undefined : Number(compedCost),
              notes: notes.trim() || undefined,
            });
            onDone();
          }}
        >
          Save · Lưu
        </Button>
      </div>
    </div>
  );
}

function KocCard({ item: k, canEdit, onChanged }: { item: KocOutreach; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{k.handle}</p>
          <p className="text-xs text-muted">
            {KOC_PLATFORM_LABEL[k.platform]} · <Bi value={KOC_TIER_LABEL[k.tier]} mode="inline" />
          </p>
        </div>
        {k.wentLive && <Badge tone="success">Live · Đã lên bài</Badge>}
      </div>
      <div className="flex flex-wrap gap-1">
        {KOC_STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => {
              updateKocOutreach(k.id, { status: s });
              onChanged();
            }}
            className={`min-h-11 px-2 rounded-full text-[11px] font-semibold border-2 ${
              k.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {KOC_STATUS_LABEL[s].en} · {KOC_STATUS_LABEL[s].vi}
          </button>
        ))}
      </div>
      {!k.wentLive && k.status === "posted" && (
        <button
          className="mt-2 min-h-11 text-xs text-brand font-semibold"
          onClick={() => {
            updateKocOutreach(k.id, { wentLive: true });
            onChanged();
          }}
        >
          Mark went live · Đánh dấu đã lên bài
        </button>
      )}
      <div className="mt-2 pt-2 border-t border-border flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0">
          <p className="text-muted">
            Comped meal · Bữa ăn mời:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {k.compedMealCostVnd !== undefined ? vnd(k.compedMealCostVnd) : "—"}
            </span>
          </p>
          {k.notes && <p className="text-muted mt-0.5">{k.notes}</p>}
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="min-h-11 px-2 flex items-center gap-1 text-brand font-semibold shrink-0"
          >
            <Pencil size={11} /> Edit · Sửa
          </button>
        )}
      </div>
      {editing && (
        <EditKocForm
          item={k}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
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
          <KocCard key={k.id} item={k} canEdit={canEdit} onChanged={refresh} />
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
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [notes, setNotes] = useState("");

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
            className={`flex-1 min-h-11 rounded-full text-xs font-semibold border-2 ${
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
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm"
      />
      <label className="block mb-2">
        <span className="block text-xs text-muted mb-1">Entry window opens · Mở đăng ký</span>
        <input
          type="date"
          value={windowStart}
          onChange={(e) => setWindowStart(e.target.value)}
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
        />
      </label>
      <label className="block mb-2">
        <span className="block text-xs text-muted mb-1">Entry window closes · Hết hạn đăng ký</span>
        <input
          type="date"
          value={windowEnd}
          onChange={(e) => setWindowEnd(e.target.value)}
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
        />
      </label>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes · Ghi chú"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            addPlatformCampaign(platform, name.trim(), windowStart || undefined, windowEnd || undefined, notes.trim() || undefined);
            setName("");
            setWindowStart("");
            setWindowEnd("");
            setNotes("");
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

/** Entry windows are usually announced after the campaign is first noted, so they stay editable on the card. */
function EditCampaignForm({ campaign, onDone }: { campaign: PlatformCampaign; onDone: () => void }) {
  const [windowStart, setWindowStart] = useState(campaign.entryWindowStart ?? "");
  const [windowEnd, setWindowEnd] = useState(campaign.entryWindowEnd ?? "");
  const [notes, setNotes] = useState(campaign.notes ?? "");

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <label className="block">
        <span className="block text-xs text-muted mb-1">Entry window opens · Mở đăng ký</span>
        <input
          type="date"
          value={windowStart}
          onChange={(e) => setWindowStart(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs text-muted mb-1">Entry window closes · Hết hạn đăng ký</span>
        <input
          type="date"
          value={windowEnd}
          onChange={(e) => setWindowEnd(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
        />
      </label>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes · Ghi chú"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={onDone}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-11 text-sm"
          onClick={() => {
            updatePlatformCampaign(campaign.id, {
              entryWindowStart: windowStart || undefined,
              entryWindowEnd: windowEnd || undefined,
              notes: notes.trim() || undefined,
            });
            onDone();
          }}
        >
          Save · Lưu
        </Button>
      </div>
    </div>
  );
}

function CampaignCard({ campaign: c, canEdit, onChanged }: { campaign: PlatformCampaign; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const windowState = getCampaignWindowState(c);
  const windowTone = windowState === "closing_soon" ? "danger" : windowState === "open" ? "success" : "muted";

  return (
    <Card>
      <p className="font-semibold text-sm">{c.name}</p>
      <p className="text-xs text-muted">{CAMPAIGN_PLATFORM_LABEL[c.platform]}</p>
      {windowState !== "none" && (
        <div className="mt-2">
          <Badge tone={windowTone} className="whitespace-normal text-left">
            <CalendarClock size={12} className="shrink-0" /> {CAMPAIGN_WINDOW_LABEL[windowState].en} · {CAMPAIGN_WINDOW_LABEL[windowState].vi}
          </Badge>
        </div>
      )}
      <p className="text-xs text-muted mt-1 mb-2">
        Entry window · Cửa sổ đăng ký:{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {c.entryWindowStart || "—"} → {c.entryWindowEnd || "—"}
        </span>
      </p>
      {c.notes && <p className="text-xs text-muted mb-2">{c.notes}</p>}
      <div className="flex flex-wrap gap-1">
        {CAMPAIGN_STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => {
              updatePlatformCampaign(c.id, { status: s });
              onChanged();
            }}
            className={`min-h-11 px-2 rounded-full text-[11px] font-semibold border-2 ${
              c.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {CAMPAIGN_STATUS_LABEL[s].en} · {CAMPAIGN_STATUS_LABEL[s].vi}
          </button>
        ))}
      </div>
      {canEdit && (
        <button
          onClick={() => setEditing((e) => !e)}
          className="mt-2 min-h-11 px-2 flex items-center gap-1 text-xs text-brand font-semibold"
        >
          <Pencil size={11} /> Edit window · Sửa cửa sổ đăng ký
        </button>
      )}
      {editing && (
        <EditCampaignForm
          campaign={c}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
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
          <CampaignCard key={c.id} campaign={c} canEdit={canEdit} onChanged={refresh} />
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
        <span>Pillar · Chủ đề</span>
        <span className="text-center">Posts · Bài</span>
        <span className="text-center">Saves · Lưu</span>
        <span className="text-center">Shares · Chia sẻ</span>
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
            ["koc", "KOC Outreach · Tiếp cận KOC"],
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
