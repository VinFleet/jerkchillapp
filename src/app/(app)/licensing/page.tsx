"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Trash2, History } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditLicensing } from "@/lib/auth/permissions";
import {
  getLicenses,
  addLicense,
  updateLicense,
  removeLicense,
  getLicenseStatus,
  formatChangedAt,
  type LicenseStatus,
  type LicenseRecord,
  type LicenseRenewal,
  type LicenseActor,
} from "@/lib/repo/licensing";
import { ROLE_LABEL } from "@/lib/roleLabels";
import { todayIso } from "@/lib/storage";

const STATUS_META: Record<LicenseStatus, { label: { en: string; vi: string }; tone: "success" | "warning" | "danger" | "muted"; icon: typeof CheckCircle2 }> = {
  not_set: { label: { en: "Add expiry date", vi: "Thêm ngày hết hạn" }, tone: "muted", icon: Pencil },
  valid: { label: { en: "Valid", vi: "Còn hiệu lực" }, tone: "success", icon: CheckCircle2 },
  expiring: { label: { en: "Renew soon", vi: "Sắp cần gia hạn" }, tone: "warning", icon: Clock },
  expired: { label: { en: "Expired", vi: "Đã hết hạn" }, tone: "danger", icon: AlertTriangle },
};

/** Tap-not-type: the reminder lead times that actually come up, in days. */
const LEAD_PRESETS = [14, 30, 60, 90];

function LeadDaysPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const options = LEAD_PRESETS.includes(value) ? LEAD_PRESETS : [...LEAD_PRESETS, value].sort((a, b) => a - b);
  return (
    <div>
      <label className="text-xs text-muted mb-1 block">Remind me before expiry · Nhắc trước khi hết hạn</label>
      <div className="flex flex-wrap gap-2">
        {options.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`min-h-11 px-3 rounded-xl border-2 text-xs font-semibold leading-tight flex flex-col items-center justify-center ${
              value === d ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            <span>{d} days</span>
            <span className="opacity-80 text-[10px]">{d} ngày</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NameFields({
  en,
  vi,
  onEn,
  onVi,
}: {
  en: string;
  vi: string;
  onEn: (v: string) => void;
  onVi: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label className="text-xs text-muted mb-1 block">Name (English)</label>
        <input
          value={en}
          onChange={(e) => onEn(e.target.value)}
          placeholder="e.g. Liquor Licence"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="text-xs text-muted mb-1 block">Tên (Tiếng Việt)</label>
        <input
          value={vi}
          onChange={(e) => onVi(e.target.value)}
          placeholder="ví dụ Giấy Phép Bán Rượu"
          className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
      </div>
    </>
  );
}

function AddLicenseForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [en, setEn] = useState("");
  const [vi, setVi] = useState("");
  const [expiry, setExpiry] = useState("");
  const [leadDays, setLeadDays] = useState(30);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add licence · Thêm giấy phép
      </button>
    );
  }

  const reset = () => {
    setEn("");
    setVi("");
    setExpiry("");
    setLeadDays(30);
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-3">New licence · Giấy phép mới</p>
      <div className="space-y-3">
        <NameFields en={en} vi={vi} onEn={setEn} onVi={setVi} />
        <div>
          <label className="text-xs text-muted mb-1 block">Expiry date (optional) · Ngày hết hạn (không bắt buộc)</label>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
          />
          <p className="text-[11px] text-muted mt-1">
            Leave blank if you don&apos;t have the certificate to hand · Để trống nếu chưa có giấy trong tay
          </p>
        </div>
        <LeadDaysPicker value={leadDays} onChange={setLeadDays} />
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="ghost" className="flex-1 min-h-12 text-sm" onClick={reset}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-12 text-sm"
          disabled={!en.trim() || !vi.trim()}
          onClick={() => {
            addLicense({ en: en.trim(), vi: vi.trim() }, expiry || null, leadDays);
            reset();
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function RenewalHistory({ history }: { history: LicenseRenewal[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? history : history.slice(0, 2);

  return (
    <div className="mt-3 pt-2 border-t border-border">
      <p className="text-[11px] font-bold text-muted uppercase tracking-wide flex items-center gap-1 mb-1">
        <History size={11} /> Renewal history · Lịch sử gia hạn
      </p>
      <ul className="space-y-1.5">
        {shown.map((h, i) => (
          <li key={`${h.changedAt}-${i}`} className="text-xs text-muted">
            <span className="line-through">{h.previousExpiry ?? "no date · chưa có ngày"}</span>
            <span className="mx-1">→</span>
            <span className="text-foreground font-semibold">{h.newExpiry ?? "no date · chưa có ngày"}</span>
            <br />
            {formatChangedAt(h.changedAt)} · {h.changedBy} ({ROLE_LABEL[h.changedByRole].en} ·{" "}
            {ROLE_LABEL[h.changedByRole].vi})
          </li>
        ))}
      </ul>
      {history.length > 2 && (
        <button onClick={() => setExpanded((e) => !e)} className="min-h-11 text-xs text-brand font-semibold">
          {expanded ? "Show less · Thu gọn" : `Show all ${history.length} · Xem tất cả ${history.length}`}
        </button>
      )}
    </div>
  );
}

function LicenseCard({
  license,
  canEdit,
  actor,
  onChanged,
}: {
  license: LicenseRecord;
  canEdit: boolean;
  actor: LicenseActor;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "date" | "details">("view");
  const [date, setDate] = useState(license.expiryDate ?? "");
  const [en, setEn] = useState(license.name.en);
  const [vi, setVi] = useState(license.name.vi);
  const [leadDays, setLeadDays] = useState(license.renewalLeadDays);
  const status = getLicenseStatus(license);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const history = license.renewalHistory ?? [];

  if (mode === "details") {
    return (
      <Card>
        <p className="font-semibold text-sm mb-3">Edit licence · Sửa giấy phép</p>
        <div className="space-y-3">
          <NameFields en={en} vi={vi} onEn={setEn} onVi={setVi} />
          <LeadDaysPicker value={leadDays} onChange={setLeadDays} />
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            variant="danger"
            className="min-h-12 text-sm px-4"
            onClick={() => {
              if (!window.confirm(`Remove ${license.name.en}? · Xóa ${license.name.vi}?`)) return;
              removeLicense(license.id);
              onChanged();
            }}
            aria-label={`Remove ${license.name.en}`}
          >
            <Trash2 size={16} /> Remove · Xóa
          </Button>
          <Button
            variant="ghost"
            className="flex-1 min-h-12 text-sm"
            onClick={() => {
              setEn(license.name.en);
              setVi(license.name.vi);
              setLeadDays(license.renewalLeadDays);
              setMode("view");
            }}
          >
            Cancel · Hủy
          </Button>
          <Button
            className="flex-1 min-h-12 text-sm"
            disabled={!en.trim() || !vi.trim()}
            onClick={() => {
              updateLicense(
                license.id,
                { name: { en: en.trim(), vi: vi.trim() }, renewalLeadDays: leadDays },
                actor
              );
              setMode("view");
              onChanged();
            }}
          >
            Save · Lưu
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={status === "expired" ? "border-danger/40" : status === "expiring" ? "border-warning/40" : undefined}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <Bi value={license.name} className="font-semibold text-sm" />
        <Badge tone={meta.tone}>
          <Icon size={12} /> {meta.label.en}
        </Badge>
      </div>
      {license.notes && <Bi value={license.notes} className="text-xs text-muted" mode="inline" />}
      <p className="text-sm mt-2">
        {license.expiryDate ? `Expires · Hết hạn: ${license.expiryDate}` : "No expiry date on file · Chưa có ngày hết hạn"}
      </p>
      <p className="text-[11px] text-muted mt-0.5">
        Reminder {license.renewalLeadDays} days before · Nhắc trước {license.renewalLeadDays} ngày
      </p>

      {canEdit &&
        (mode === "date" ? (
          <div className="mt-3">
            <label className="text-xs text-muted mb-1 block">New expiry date · Ngày hết hạn mới</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
              />
              <Button
                className="min-h-11 text-sm"
                disabled={!date}
                onClick={() => {
                  updateLicense(license.id, { expiryDate: date }, actor);
                  setMode("view");
                  onChanged();
                }}
              >
                Save · Lưu
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 text-sm"
                onClick={() => {
                  setDate(license.expiryDate ?? "");
                  setMode("view");
                }}
              >
                Cancel · Hủy
              </Button>
            </div>
            {license.expiryDate && (
              <p className="text-[11px] text-muted mt-2">
                The old date ({license.expiryDate}) is kept in the renewal history · Ngày cũ ({license.expiryDate}) được
                lưu vào lịch sử gia hạn
              </p>
            )}
          </div>
        ) : (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setMode("date")}
              className="min-h-11 px-3 rounded-xl border-2 border-border text-xs text-brand font-semibold flex items-center gap-1"
            >
              <Pencil size={12} /> {license.expiryDate ? "Update date · Cập nhật ngày" : "Add date · Thêm ngày"}
            </button>
            <button
              onClick={() => setMode("details")}
              className="min-h-11 px-3 rounded-xl border-2 border-border text-xs text-brand font-semibold flex items-center gap-1"
            >
              Edit details · Sửa chi tiết
            </button>
          </div>
        ))}

      {history.length > 0 && <RenewalHistory history={history} />}
    </Card>
  );
}

function LicensingContent() {
  const { session } = useSession();
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const refresh = () => setLicenses(getLicenses());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const canEdit = canEditLicensing(session.role);
  const actor: LicenseActor = { name: session.name, role: session.role };
  const today = todayIso();
  const needsAttention = licenses.filter((l) => {
    const s = getLicenseStatus(l, today);
    return s === "expiring" || s === "expired";
  });

  return (
    <div className="pb-6">
      <PageHeader title="Licensing & Compliance · Giấy Phép & Tuân Thủ" subtitle="Renewal reminders · Nhắc nhở gia hạn" />
      <div className="px-4 md:px-8">
        {needsAttention.length > 0 && (
          <Card className="mb-4 border-warning/40 bg-warning-tint">
            <p className="font-bold text-sm text-warning">
              {needsAttention.length} licence{needsAttention.length > 1 ? "s" : ""} need attention · cần chú ý
            </p>
          </Card>
        )}
        {canEdit && <AddLicenseForm onAdded={refresh} />}
        <div className="space-y-2">
          {licenses.map((l) => (
            <LicenseCard key={l.id} license={l} canEdit={canEdit} actor={actor} onChanged={refresh} />
          ))}
        </div>
        {licenses.length === 0 && (
          <p className="text-muted text-center py-10 text-sm">No licences tracked yet · Chưa theo dõi giấy phép nào</p>
        )}
      </div>
    </div>
  );
}

export default function LicensingPage() {
  return (
    <RoleGate module="licensing">
      <LicensingContent />
    </RoleGate>
  );
}
