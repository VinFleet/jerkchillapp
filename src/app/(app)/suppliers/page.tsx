"use client";

import { useEffect, useState } from "react";
import { Plus, Bell } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditSuppliers } from "@/lib/auth/permissions";
import { getSuppliers, addSupplier, getRejections, logRejection, getEvaluations, logEvaluation } from "@/lib/repo/suppliers";
import { SUPPLIER_CATEGORY_LABEL, SUPPLIER_STATUS_LABEL, SUPPLIER_STATUS_TONE } from "@/lib/supplierLabels";
import { todayIso } from "@/lib/storage";
import type { Supplier, RejectionRecord, SupplierEvaluation, SupplierCategory, EvaluationDecision } from "@/lib/types";

type Tab = "suppliers" | "rejections" | "evaluations";

function AddSupplierForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SupplierCategory>("grocery");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add supplier · Thêm nhà cung cấp
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New supplier · Nhà cung cấp mới</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name · Tên"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as SupplierCategory)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm bg-surface focus:outline-none focus:border-brand"
      >
        {(Object.keys(SUPPLIER_CATEGORY_LABEL) as SupplierCategory[]).map((c) => (
          <option key={c} value={c}>
            {SUPPLIER_CATEGORY_LABEL[c].en} · {SUPPLIER_CATEGORY_LABEL[c].vi}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            addSupplier(name.trim(), category);
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

function SuppliersTab({ canEdit }: { canEdit: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const refresh = () => setSuppliers(getSuppliers());
  useEffect(() => refresh(), []);

  return (
    <div>
      {canEdit && <AddSupplierForm onAdded={refresh} />}
      <div className="space-y-2">
        {suppliers.map((s) => (
          <Card key={s.id}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm">{s.name}</p>
              <Badge tone={SUPPLIER_STATUS_TONE[s.status]}>{SUPPLIER_STATUS_LABEL[s.status].en}</Badge>
            </div>
            <Bi value={SUPPLIER_CATEGORY_LABEL[s.category]} mode="inline" className="text-xs text-muted" />
            {s.foodSafetyCertExpiry && <p className="text-xs text-muted mt-1">Food safety cert expires {s.foodSafetyCertExpiry}</p>}
            {s.lastReviewed && <p className="text-xs text-muted">Last reviewed {s.lastReviewed}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function AddRejectionForm({ suppliers, onAdded, staffName }: { suppliers: Supplier[]; onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [notified, setNotified] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a rejection · Ghi từ chối hàng
      </button>
    );
  }

  const reset = () => {
    setSupplierId("");
    setReason("");
    setAction("");
    setNotified(false);
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New rejection · Từ chối mới</p>
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm bg-surface focus:outline-none focus:border-brand"
      >
        <option value="">Select supplier · Chọn nhà cung cấp</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason · Lý do"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="Action taken · Hành động đã thực hiện"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <button
        onClick={() => setNotified((v) => !v)}
        className={`w-full min-h-11 rounded-xl border-2 font-semibold text-sm mb-3 ${
          notified ? "bg-brand text-white border-brand" : "border-border text-muted"
        }`}
      >
        {notified ? "✓ Supplier notified · Đã báo nhà cung cấp" : "Supplier notified? · Đã báo nhà cung cấp?"}
      </button>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!supplierId || !reason.trim() || !action.trim()}
          onClick={() => {
            logRejection({ supplierId, reason: reason.trim(), actionTaken: action.trim(), supplierNotified: notified, loggedBy: staffName });
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

function RejectionsTab({ suppliers, canEdit, staffName }: { suppliers: Supplier[]; canEdit: boolean; staffName: string }) {
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const refresh = () => setRejections(getRejections());
  useEffect(() => refresh(), []);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      {canEdit && <AddRejectionForm suppliers={suppliers} onAdded={refresh} staffName={staffName} />}
      <div className="space-y-2">
        {rejections.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm">{supplierName(r.supplierId)}</p>
              <Badge tone={r.supplierNotified ? "success" : "warning"}>
                <Bell size={12} /> {r.supplierNotified ? "Notified" : "Not notified"}
              </Badge>
            </div>
            <p className="text-xs text-muted mb-1">
              {r.date} · {r.loggedBy}
            </p>
            <p className="text-sm">{r.reason}</p>
            <p className="text-xs text-muted mt-1">Action: {r.actionTaken}</p>
          </Card>
        ))}
        {rejections.length === 0 && <p className="text-muted text-center py-10 text-sm">No rejections logged · Chưa có từ chối nào</p>}
      </div>
    </div>
  );
}

function ScorePicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-2">
      <p className="text-xs text-muted mb-1">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 min-h-10 rounded-lg font-bold text-sm border-2 ${
              value === n ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddEvaluationForm({ suppliers, onAdded, staffName }: { suppliers: Supplier[]; onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [period, setPeriod] = useState(String(new Date(todayIso()).getFullYear()));
  const [quality, setQuality] = useState(3);
  const [onTime, setOnTime] = useState(3);
  const [docs, setDocs] = useState(3);
  const [decision, setDecision] = useState<EvaluationDecision>("continue");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Evaluate a supplier · Đánh giá nhà cung cấp
      </button>
    );
  }

  const reset = () => {
    setSupplierId("");
    setQuality(3);
    setOnTime(3);
    setDocs(3);
    setDecision("continue");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New evaluation · Đánh giá mới</p>
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm bg-surface focus:outline-none focus:border-brand"
      >
        <option value="">Select supplier · Chọn nhà cung cấp</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        placeholder="Period · Kỳ đánh giá (e.g. 2026)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <ScorePicker label="Quality · Chất lượng" value={quality} onChange={setQuality} />
      <ScorePicker label="On-time delivery · Giao hàng đúng hẹn" value={onTime} onChange={setOnTime} />
      <ScorePicker label="Documentation · Hồ sơ giấy tờ" value={docs} onChange={setDocs} />
      <p className="text-xs text-muted mb-1 mt-2">Decision · Quyết định</p>
      <div className="flex gap-2 mb-3">
        {(["continue", "review", "replace"] as EvaluationDecision[]).map((d) => (
          <button
            key={d}
            onClick={() => setDecision(d)}
            className={`flex-1 min-h-10 rounded-full text-xs font-semibold border-2 capitalize ${
              decision === d ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!supplierId || !period.trim()}
          onClick={() => {
            logEvaluation({
              supplierId,
              period: period.trim(),
              qualityScore: quality,
              onTimeScore: onTime,
              documentationScore: docs,
              decision,
              evaluatedBy: staffName,
            });
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

function EvaluationsTab({ suppliers, canEdit, staffName }: { suppliers: Supplier[]; canEdit: boolean; staffName: string }) {
  const [evaluations, setEvaluations] = useState<SupplierEvaluation[]>([]);
  const refresh = () => setEvaluations(getEvaluations());
  useEffect(() => refresh(), []);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      {canEdit && <AddEvaluationForm suppliers={suppliers} onAdded={refresh} staffName={staffName} />}
      <div className="space-y-2">
        {evaluations.map((e) => (
          <Card key={e.id}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm">
                {supplierName(e.supplierId)} · {e.period}
              </p>
              <Badge tone={e.decision === "continue" ? "success" : e.decision === "review" ? "warning" : "danger"}>{e.decision}</Badge>
            </div>
            <p className="text-xs text-muted">
              Quality {e.qualityScore}/5 · On-time {e.onTimeScore}/5 · Docs {e.documentationScore}/5
            </p>
            <p className="text-xs text-muted mt-1">{e.evaluatedBy}</p>
          </Card>
        ))}
        {evaluations.length === 0 && <p className="text-muted text-center py-10 text-sm">No evaluations yet · Chưa có đánh giá nào</p>}
      </div>
    </div>
  );
}

function SuppliersContent() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    setSuppliers(getSuppliers());
  }, [tab]);

  if (!session) return null;
  const canEdit = canEditSuppliers(session.role);

  return (
    <div className="pb-6">
      <PageHeader title="Supplier Management · Quản Lý Nhà Cung Cấp" subtitle="Approved list, rejections, evaluations · Danh sách, từ chối, đánh giá" />
      <div className="px-4 md:px-8">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            ["suppliers", "Suppliers · NCC"],
            ["rejections", "Rejections · Từ chối"],
            ["evaluations", "Evaluations · Đánh giá"],
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

        {tab === "suppliers" && <SuppliersTab canEdit={canEdit} />}
        {tab === "rejections" && <RejectionsTab suppliers={suppliers} canEdit={canEdit} staffName={session.name} />}
        {tab === "evaluations" && <EvaluationsTab suppliers={suppliers} canEdit={canEdit} staffName={session.name} />}
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <RoleGate module="suppliers">
      <SuppliersContent />
    </RoleGate>
  );
}
