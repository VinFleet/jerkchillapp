"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditSuppliers } from "@/lib/auth/permissions";
import { getComplaints, logComplaint, updateComplaintOutcome } from "@/lib/repo/foodSafety";
import { todayIso } from "@/lib/storage";
import type { ComplaintLog, ComplaintCategory, ComplaintSeverity } from "@/lib/types";

const CATEGORY_LABEL: Record<ComplaintCategory, { en: string; vi: string }> = {
  allergy: { en: "Allergy", vi: "Dị ứng" },
  quality: { en: "Food quality", vi: "Chất lượng món ăn" },
  service: { en: "Service", vi: "Phục vụ" },
  other: { en: "Other", vi: "Khác" },
};

const SEVERITY_TONE: Record<ComplaintSeverity, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const SEVERITY_LABEL: Record<ComplaintSeverity, { en: string; vi: string }> = {
  low: { en: "Low", vi: "Nhẹ" },
  medium: { en: "Medium", vi: "Trung bình" },
  high: { en: "High", vi: "Nghiêm trọng" },
};

function AddForm({ onAdded, staffName }: { onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("allergy");
  const [severity, setSeverity] = useState<ComplaintSeverity>("medium");
  const [description, setDescription] = useState("");
  const [reportedToAuthority, setReportedToAuthority] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a complaint · Ghi khiếu nại
      </button>
    );
  }

  const reset = () => {
    setGuestName("");
    setGuestContact("");
    setCategory("allergy");
    setSeverity("medium");
    setDescription("");
    setReportedToAuthority(false);
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New complaint · Khiếu nại mới</p>
      <input
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        placeholder="Guest name · Tên khách"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={guestContact}
        onChange={(e) => setGuestContact(e.target.value)}
        placeholder="Guest contact (optional) · Liên hệ khách"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex flex-wrap gap-2 mb-2">
        {(Object.keys(CATEGORY_LABEL) as ComplaintCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`min-h-10 px-3 rounded-full text-xs font-semibold border-2 ${
              category === c ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {CATEGORY_LABEL[c].en} · {CATEGORY_LABEL[c].vi}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-2">
        {(["low", "medium", "high"] as ComplaintSeverity[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`flex-1 min-h-11 rounded-full text-xs font-semibold border-2 ${
              severity === s ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {SEVERITY_LABEL[s].en} · {SEVERITY_LABEL[s].vi}
          </button>
        ))}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What happened · Chuyện gì đã xảy ra"
        rows={3}
        className="w-full rounded-xl border-2 border-border px-3 py-2 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <button
        onClick={() => setReportedToAuthority((v) => !v)}
        className={`w-full min-h-11 rounded-xl border-2 font-semibold text-sm mb-3 ${
          reportedToAuthority ? "bg-brand text-white border-brand" : "border-border text-muted"
        }`}
      >
        {reportedToAuthority ? "✓ Reported to authority · Đã báo cơ quan chức năng" : "Reported to authority? · Đã báo cơ quan chức năng?"}
      </button>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!guestName.trim() || !description.trim()}
          onClick={() => {
            logComplaint(todayIso(), guestName.trim(), category, description.trim(), severity, staffName, guestContact.trim() || undefined, reportedToAuthority);
            reset();
            onAdded();
          }}
        >
          Save · Lưu
        </Button>
      </div>
    </Card>
  );
}

function OutcomeForm({ complaint, staffName, onSaved }: { complaint: ComplaintLog; staffName: string; onSaved: () => void }) {
  const [investigation, setInvestigation] = useState(complaint.investigation ?? "");
  const [outcome, setOutcome] = useState(complaint.outcome ?? "");
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const revisions = complaint.revisions ?? [];

  if (!editing && complaint.outcome) {
    return (
      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Outcome · Kết quả</p>
        <p className="text-sm">{complaint.outcome}</p>
        <div className="flex items-center gap-3 mt-1">
          <button onClick={() => setEditing(true)} className="text-xs text-brand font-semibold">
            Edit · Sửa
          </button>
          {revisions.length > 0 && (
            <button onClick={() => setShowHistory((v) => !v)} className="text-xs text-muted font-semibold">
              {showHistory ? "Hide" : "Show"} {revisions.length} earlier version{revisions.length > 1 ? "s" : ""} ·{" "}
              {showHistory ? "Ẩn" : "Xem"} bản trước
            </button>
          )}
        </div>
        {showHistory && (
          <div className="mt-2 space-y-2">
            {revisions.map((r, i) => (
              <div key={i} className="rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2">
                <p className="text-[11px] text-muted">
                  Replaced by {r.replacedBy} · {new Date(r.replacedAt).toLocaleString()}
                </p>
                {r.investigation && <p className="text-xs mt-1">Investigation: {r.investigation}</p>}
                {r.outcome && <p className="text-xs">Outcome: {r.outcome}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-brand font-semibold mt-2">
        + Add investigation & outcome · Thêm điều tra & kết quả
      </button>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <textarea
        value={investigation}
        onChange={(e) => setInvestigation(e.target.value)}
        placeholder="Investigation · Điều tra"
        rows={2}
        className="w-full rounded-xl border-2 border-border px-3 py-2 text-sm focus:outline-none focus:border-brand"
      />
      <textarea
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder="Outcome · Kết quả"
        rows={2}
        className="w-full rounded-xl border-2 border-border px-3 py-2 text-sm focus:outline-none focus:border-brand"
      />
      {complaint.outcome && (
        <p className="text-[11px] text-muted">
          The current version is kept on file as an earlier version · Bản hiện tại sẽ được lưu lại làm bản trước
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-10 text-sm" onClick={() => setEditing(false)}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-10 text-sm"
          onClick={() => {
            updateComplaintOutcome(complaint.id, investigation.trim(), outcome.trim(), staffName);
            setEditing(false);
            onSaved();
          }}
        >
          Save · Lưu
        </Button>
      </div>
    </div>
  );
}

function ComplaintsContent() {
  const { session } = useSession();
  const [complaints, setComplaints] = useState<ComplaintLog[]>([]);
  const refresh = () => setComplaints(getComplaints());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const canManage = canEditSuppliers(session.role); // owner/manager investigate & close out

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Customer Complaints · Khiếu Nại Khách Hàng"
        subtitle="Especially allergy-related · Đặc biệt liên quan đến dị ứng"
      />
      <div className="px-4 md:px-8">
        <AddForm onAdded={refresh} staffName={session.name} />
        <div className="space-y-2">
          {complaints.map((c) => (
            <Card key={c.id} className={c.category === "allergy" ? "border-danger/30" : undefined}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-sm">{c.guestName}</p>
                <div className="flex gap-1 shrink-0">
                  {c.category === "allergy" && (
                    <Badge tone="danger">
                      <AlertTriangle size={12} /> Allergy
                    </Badge>
                  )}
                  <Badge tone={SEVERITY_TONE[c.severity]}>{c.severity}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted mb-1">
                {c.date} · {c.loggedBy} · {CATEGORY_LABEL[c.category].en} · {CATEGORY_LABEL[c.category].vi}
              </p>
              <p className="text-sm">{c.description}</p>
              {c.reportedToAuthority && (
                <p className="text-xs text-muted mt-1">Reported to authority · Đã báo cơ quan chức năng</p>
              )}
              {canManage && <OutcomeForm complaint={c} staffName={session.name} onSaved={refresh} />}
            </Card>
          ))}
          {complaints.length === 0 && <p className="text-muted text-center py-10 text-sm">No complaints logged · Chưa có khiếu nại nào</p>}
        </div>
      </div>
    </div>
  );
}

export default function ComplaintsPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="complaints">
        <ComplaintsContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
