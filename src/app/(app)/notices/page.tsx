"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/RoleContext";
import { useSync } from "@/lib/sync/SyncProvider";
import { canPostNotice } from "@/lib/auth/permissions";
import { getNotices, postNotice, getAcks, isAckedBy, ackNotice } from "@/lib/repo/notices";
import { getStaff } from "@/lib/repo/staff";
import type { Notice, NoticePriority } from "@/lib/types";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now · vừa xong";
  if (hours < 24) return `${hours}h ago · ${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days}d ago · ${days} ngày trước`;
}

function NoticeCard({ notice, staffName, isManager }: { notice: Notice; staffName: string; isManager: boolean }) {
  const [acked, setAcked] = useState(false);
  const [ackNames, setAckNames] = useState<string[]>([]);
  const [notRead, setNotRead] = useState<string[]>([]);
  const [showWho, setShowWho] = useState(false);
  const { dataVersion } = useSync();
  const ackCount = ackNames.length;

  useEffect(() => {
    setAcked(isAckedBy(notice.id, staffName));
    const read = getAcks(notice.id).map((a) => a.staffName);
    setAckNames(read);
    // Compared against the active staff directory, so someone who has left
    // doesn't sit on the list forever as "hasn't read it".
    setNotRead(getStaff().map((s) => s.name).filter((n) => !read.includes(n)));
  }, [notice.id, staffName, dataVersion]);

  return (
    <Card className={notice.priority === "urgent" ? "border-danger/40" : undefined}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Bi value={notice.title} className="font-bold text-base" />
        {notice.priority === "urgent" && (
          <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-danger bg-danger-tint px-2 py-1 rounded-full">
            <AlertCircle size={12} /> Urgent
          </span>
        )}
      </div>
      <Bi value={notice.body} className="text-sm" viClassName="text-sm" />
      <p className="text-xs text-muted mt-3">
        {notice.postedBy} · {timeAgo(notice.createdAt)}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <button
          onClick={() => {
            ackNotice(notice.id, staffName);
            setAcked(true);
            setAckNames(getAcks(notice.id).map((a) => a.staffName));
          }}
          disabled={acked}
          className={`flex items-center gap-2 text-sm font-semibold min-h-11 ${
            acked ? "text-success" : "text-brand"
          }`}
        >
          <CheckCircle2 size={18} />
          {acked ? "Acknowledged · Đã xác nhận" : "Mark as read · Đánh dấu đã đọc"}
        </button>
        {isManager && (
          <button
            onClick={() => setShowWho((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted font-semibold"
            aria-label="Show who has read this"
          >
            <Users size={14} /> {ackCount}
          </button>
        )}
      </div>
      {/* "How many" isn't the useful question on a team this size — "who
          hasn't" is, because that's the list of people who still need
          telling in person. */}
      {isManager && showWho && (
        <div className="text-xs mt-2 pt-2 border-t border-border space-y-1">
          {notRead.length > 0 ? (
            <p className="text-warning font-semibold">
              Not read yet · Chưa đọc: {notRead.join(", ")}
            </p>
          ) : (
            <p className="text-success font-semibold">Everyone has read this · Mọi người đã đọc</p>
          )}
          {ackCount > 0 && <p className="text-muted">Read by · Đã đọc: {ackNames.join(", ")}</p>}
        </div>
      )}
    </Card>
  );
}

/**
 * The recurring notices this board exists to replace in the group chat.
 * Posting "we're out of X" shouldn't mean writing four fields, two of them
 * translations — that's slower than the chat it's meant to beat, so nobody
 * would use it mid-shift. Each template fills both languages and leaves only
 * the variable part to type.
 */
const QUICK_TEMPLATES: {
  key: string;
  chip: string;
  priority: NoticePriority;
  /** what the person fills in, e.g. the item that ran out */
  fieldLabel: string;
  build: (v: string) => { title: { en: string; vi: string }; body: { en: string; vi: string } };
}[] = [
  {
    key: "out_of_stock",
    chip: "Out of · Hết hàng",
    priority: "urgent",
    fieldLabel: "What ran out? · Hết món gì?",
    build: (v) => ({
      title: { en: `We're out of ${v}`, vi: `Đã hết ${v}` },
      body: {
        en: `${v} has run out — 86 it and tell guests before they order.`,
        vi: `${v} đã hết — ngừng bán và báo khách trước khi họ gọi món.`,
      },
    }),
  },
  {
    key: "running_low",
    chip: "Running low · Sắp hết",
    priority: "normal",
    fieldLabel: "What's running low? · Món nào sắp hết?",
    build: (v) => ({
      title: { en: `${v} running low`, vi: `${v} sắp hết` },
      body: { en: `Go easy on ${v} until the next delivery.`, vi: `Hạn chế dùng ${v} đến khi có hàng mới.` },
    }),
  },
  {
    key: "price_change",
    chip: "New price · Giá mới",
    priority: "normal",
    fieldLabel: "Which supplier or item? · Nhà cung cấp / mặt hàng nào?",
    build: (v) => ({
      title: { en: `New price — ${v}`, vi: `Giá mới — ${v}` },
      body: { en: `${v} pricing has changed. Check before ordering.`, vi: `Giá của ${v} đã thay đổi. Kiểm tra trước khi đặt hàng.` },
    }),
  },
  {
    key: "allergy",
    chip: "Allergy · Dị ứng",
    priority: "urgent",
    fieldLabel: "Table and allergy · Bàn và loại dị ứng",
    build: (v) => ({
      title: { en: `Allergy — ${v}`, vi: `Dị ứng — ${v}` },
      body: {
        en: `${v}. Check every component before it leaves the pass.`,
        vi: `${v}. Kiểm tra mọi thành phần trước khi lên món.`,
      },
    }),
  },
];

function QuickPost({ onPosted }: { onPosted: () => void }) {
  const { session } = useSession();
  const [active, setActive] = useState<string | null>(null);
  const [value, setValue] = useState("");
  if (!session) return null;

  const template = QUICK_TEMPLATES.find((t) => t.key === active);

  return (
    <Card className="mb-3">
      <p className="font-semibold text-sm mb-2">Quick post · Đăng nhanh</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_TEMPLATES.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActive(active === t.key ? null : t.key);
              setValue("");
            }}
            className={`min-h-11 px-3 rounded-full text-xs font-semibold border-2 ${
              active === t.key ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {t.chip}
          </button>
        ))}
      </div>

      {template && (
        <div className="mt-3">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={template.fieldLabel}
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
          />
          {template.priority === "urgent" && (
            <p className="text-xs text-danger font-semibold mt-1.5">
              Posts as urgent — everyone must acknowledge it · Đăng dạng khẩn — mọi người phải xác nhận
            </p>
          )}
          <Button
            className="w-full min-h-12 text-sm mt-2"
            disabled={!value.trim()}
            onClick={() => {
              const { title, body } = template.build(value.trim());
              postNotice(title, body, session.name, session.role, template.priority);
              setActive(null);
              setValue("");
              onPosted();
            }}
          >
            Post · Đăng
          </Button>
        </div>
      )}
    </Card>
  );
}

function PostNoticeForm({ onPosted }: { onPosted: () => void }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [titleEn, setTitleEn] = useState("");
  const [titleVi, setTitleVi] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyVi, setBodyVi] = useState("");
  const [priority, setPriority] = useState<NoticePriority>("normal");

  if (!session) return null;

  if (!open) {
    return (
      <Button className="w-full mb-4" onClick={() => setOpen(true)}>
        <Plus size={18} /> Write a different notice · Viết thông báo khác
      </Button>
    );
  }

  const reset = () => {
    setTitleEn("");
    setTitleVi("");
    setBodyEn("");
    setBodyVi("");
    setPriority("normal");
    setOpen(false);
  };

  const canSubmit = titleEn.trim() && titleVi.trim() && bodyEn.trim() && bodyVi.trim();

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-3">New notice · Thông báo mới</p>
      <div className="space-y-2 mb-3">
        <input
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          placeholder="Title (English)"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
        <input
          value={titleVi}
          onChange={(e) => setTitleVi(e.target.value)}
          placeholder="Tiêu đề (Tiếng Việt)"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
        <textarea
          value={bodyEn}
          onChange={(e) => setBodyEn(e.target.value)}
          placeholder="Details (English)"
          rows={2}
          className="w-full rounded-xl border-2 border-border px-3 py-2 text-sm focus:outline-none focus:border-brand"
        />
        <textarea
          value={bodyVi}
          onChange={(e) => setBodyVi(e.target.value)}
          placeholder="Chi tiết (Tiếng Việt)"
          rows={2}
          className="w-full rounded-xl border-2 border-border px-3 py-2 text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <div className="flex gap-2 mb-3">
        {(["normal", "urgent"] as NoticePriority[]).map((p) => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={`flex-1 min-h-11 rounded-full text-sm font-semibold border-2 ${
              priority === p ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {p === "normal" ? "Normal · Thường" : "Urgent · Khẩn cấp"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!canSubmit}
          onClick={() => {
            postNotice(
              { en: titleEn.trim(), vi: titleVi.trim() },
              { en: bodyEn.trim(), vi: bodyVi.trim() },
              session.name,
              session.role,
              priority
            );
            reset();
            onPosted();
          }}
        >
          Post · Đăng
        </Button>
      </div>
    </Card>
  );
}

function NoticesPageContent() {
  const { session } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const { dataVersion } = useSync();

  const refresh = () => setNotices(getNotices());

  // A notice posted on the manager's phone should appear here without anyone
  // reloading — that's the whole point of it replacing the group chat.
  useEffect(() => {
    refresh();
  }, [dataVersion]);

  if (!session) return null;
  const isManager = session.role === "owner" || session.role === "manager";

  return (
    <div className="pb-6">
      <PageHeader title="Notice Board · Bảng Thông Báo" subtitle="Read and acknowledge · Đọc và xác nhận" />
      <div className="px-4 md:px-8">
        {canPostNotice(session.role) && (
          <>
            <QuickPost onPosted={refresh} />
            <PostNoticeForm onPosted={refresh} />
          </>
        )}
        <div className="space-y-3">
          {notices.map((n) => (
            <NoticeCard key={n.id} notice={n} staffName={session.name} isManager={isManager} />
          ))}
          {notices.length === 0 && (
            <p className="text-muted text-center py-10 text-sm">No notices yet · Chưa có thông báo</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NoticesPage() {
  return (
    <RoleGate module="notices">
      <NoticesPageContent />
    </RoleGate>
  );
}
