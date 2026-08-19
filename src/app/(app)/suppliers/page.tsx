"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Bell, ChevronRight, Trash2, Award } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditSuppliers, canManageSuppliers } from "@/lib/auth/permissions";
import {
  getSuppliers,
  addSupplier,
  getRejections,
  logRejection,
  getEvaluations,
  logEvaluation,
  getQuotes,
  addQuote,
  deleteQuote,
} from "@/lib/repo/suppliers";
import { SUPPLIER_CATEGORY_LABEL, SUPPLIER_STATUS_LABEL, SUPPLIER_STATUS_TONE } from "@/lib/supplierLabels";
import { todayIso } from "@/lib/storage";
import type { Supplier, RejectionRecord, SupplierEvaluation, SupplierCategory, EvaluationDecision, SupplierQuote } from "@/lib/types";

type Tab = "suppliers" | "prices" | "rejections" | "evaluations";

function AddSupplierForm({ onAdded }: { onAdded: (supplier: Supplier) => void }) {
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
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm bg-surface focus:outline-none focus:border-brand"
      >
        {(Object.keys(SUPPLIER_CATEGORY_LABEL) as SupplierCategory[]).map((c) => (
          <option key={c} value={c}>
            {SUPPLIER_CATEGORY_LABEL[c].en} · {SUPPLIER_CATEGORY_LABEL[c].vi}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted mb-3 flex items-center gap-1.5">
        <Award size={13} className="shrink-0" />
        A compliance paperwork checklist is added automatically · Danh mục giấy tờ tuân thủ sẽ tự động được thêm
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            const created = addSupplier(name.trim(), category);
            setName("");
            setOpen(false);
            onAdded(created);
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function SuppliersTab({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const refresh = () => setSuppliers(getSuppliers());
  useEffect(() => refresh(), []);

  return (
    <div>
      {canEdit && (
        <AddSupplierForm
          onAdded={(created) => {
            // Land straight on the new supplier's page so the compliance
            // checklist that was just attached is the first thing seen.
            router.push(`/suppliers/${created.id}`);
          }}
        />
      )}
      <div className="space-y-2">
        {suppliers.map((s) => (
          <Link key={s.id} href={`/suppliers/${s.id}`}>
            <Card className="active:bg-brand-light transition-colors">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{s.name}</p>
                    <Badge tone={SUPPLIER_STATUS_TONE[s.status]}>{SUPPLIER_STATUS_LABEL[s.status].en}</Badge>
                  </div>
                  <Bi value={SUPPLIER_CATEGORY_LABEL[s.category]} mode="inline" className="text-xs text-muted" />
                  {s.foodSafetyCertExpiry && <p className="text-xs text-muted mt-1">Food safety cert expires {s.foodSafetyCertExpiry}</p>}
                  {s.lastReviewed && <p className="text-xs text-muted">Last reviewed {s.lastReviewed}</p>}
                </div>
                <ChevronRight size={18} className="text-muted shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AddQuoteForm({ suppliers, onAdded, staffName }: { suppliers: Supplier[]; onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [itemName, setItemName] = useState("");
  const [packSize, setPackSize] = useState("");
  const [unit, setUnit] = useState("");
  const [packCostVnd, setPackCostVnd] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add a price quote · Thêm báo giá
      </button>
    );
  }

  const reset = () => {
    setSupplierId("");
    setItemName("");
    setPackSize("");
    setUnit("");
    setPackCostVnd("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New price quote · Báo giá mới</p>
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
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="Item · Mặt hàng (e.g. Chicken leg quarters)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
        list="quote-item-names"
      />
      <div className="flex gap-2 mb-2">
        <input
          value={packSize}
          onChange={(e) => setPackSize(e.target.value)}
          placeholder="Pack size · Quy cách (e.g. 4pc pack)"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit · ĐVT (e.g. kg)"
          className="w-28 min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <input
        type="number"
        inputMode="decimal"
        value={packCostVnd}
        onChange={(e) => setPackCostVnd(e.target.value)}
        placeholder="Price (₫) · Giá (₫)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!supplierId || !itemName.trim() || !packSize.trim() || !unit.trim() || !packCostVnd.trim()}
          onClick={() => {
            addQuote({
              supplierId,
              itemName: itemName.trim(),
              packSize: packSize.trim(),
              unit: unit.trim(),
              packCostVnd: Number(packCostVnd),
              loggedBy: staffName,
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

function PricesTab({ suppliers, canEdit, staffName }: { suppliers: Supplier[]; canEdit: boolean; staffName: string }) {
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const refresh = () => setQuotes(getQuotes());
  useEffect(() => refresh(), []);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const groups = new Map<string, SupplierQuote[]>();
  for (const q of quotes) {
    const key = q.itemName.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }
  const sortedGroups = Array.from(groups.values())
    .map((g) => [...g].sort((a, b) => a.packCostVnd - b.packCostVnd))
    .sort((a, b) => a[0].itemName.localeCompare(b[0].itemName));

  return (
    <div>
      {canEdit && <AddQuoteForm suppliers={suppliers} onAdded={refresh} staffName={staffName} />}
      <datalist id="quote-item-names">
        {Array.from(new Set(quotes.map((q) => q.itemName))).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="space-y-3">
        {sortedGroups.map((group) => (
          <Card key={group[0].itemName.trim().toLowerCase()}>
            <p className="font-semibold text-sm mb-2">{group[0].itemName}</p>
            <div className="space-y-1.5">
              {group.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{supplierName(q.supplierId)}</span>
                    <span className="text-muted"> · {q.packSize}</span>
                    {i === 0 && group.length > 1 && (
                      <Badge tone="success" className="ml-2">
                        Best price · Rẻ nhất
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold">
                      {q.packCostVnd.toLocaleString("vi-VN")}₫/{q.unit}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => {
                          deleteQuote(q.id);
                          refresh();
                        }}
                        className="text-danger"
                        aria-label="Delete quote"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {sortedGroups.length === 0 && (
          <p className="text-muted text-center py-10 text-sm">No price quotes logged yet · Chưa có báo giá nào</p>
        )}
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
  const [docsOk, setDocsOk] = useState(true);
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
    setDocsOk(true);
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
      <p className="text-xs text-muted mb-1">Docs OK? · Hồ sơ đạt?</p>
      <div className="flex gap-2 mb-3">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            onClick={() => setDocsOk(v)}
            className={`flex-1 min-h-10 rounded-full text-xs font-semibold border-2 ${
              docsOk === v ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {v ? "Yes · Đạt" : "No · Chưa đạt"}
          </button>
        ))}
      </div>
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
              docsOk,
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
              Quality {e.qualityScore}/5 · On-time {e.onTimeScore}/5 · Docs {e.docsOk ? "OK" : "Not OK"}
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
  const canManage = canManageSuppliers(session.role);

  return (
    <div className="pb-6">
      <PageHeader title="Supplier Management · Quản Lý Nhà Cung Cấp" subtitle="Approved list, prices, rejections, evaluations · Danh sách, giá, từ chối, đánh giá" />
      <div className="px-4 md:px-8">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            ["suppliers", "Suppliers · NCC"],
            ["prices", "Prices · Giá"],
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

        {tab === "suppliers" && <SuppliersTab canEdit={canManage} />}
        {tab === "prices" && <PricesTab suppliers={suppliers} canEdit={canManage} staffName={session.name} />}
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
