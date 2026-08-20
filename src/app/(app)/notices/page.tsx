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
  const [showWho, setShowWho] = useState(false);
  const { dataVersion } = useSync();
  const ackCount = ackNames.length;

  useEffect(() => {
    setAcked(isAckedBy(notice.id, staffName));
    setAckNames(getAcks(notice.id).map((a) => a.staffName));
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
      {/* "How many" isn't the useful question on a team this size — "who"
          is, so a manager knows who still needs telling in person. */}
      {isManager && showWho && (
        <p className="text-xs text-muted mt-2 pt-2 border-t border-border">
          {ackCount > 0 ? (
            <>Read by · Đã đọc: {ackNames.join(", ")}</>
          ) : (
            <>Nobody has read this yet · Chưa ai đọc</>
          )}
        </p>
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
        <Plus size={18} /> Post notice · Đăng thông báo
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
        {canPostNotice(session.role) && <PostNoticeForm onPosted={refresh} />}
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
