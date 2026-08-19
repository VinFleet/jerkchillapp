"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Pencil } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditLicensing } from "@/lib/auth/permissions";
import { getLicenses, updateLicense, getLicenseStatus, type LicenseStatus } from "@/lib/repo/licensing";
import { todayIso } from "@/lib/storage";
import type { License } from "@/lib/types";

const STATUS_META: Record<LicenseStatus, { label: { en: string; vi: string }; tone: "success" | "warning" | "danger" | "muted"; icon: typeof CheckCircle2 }> = {
  not_set: { label: { en: "Add expiry date", vi: "Thêm ngày hết hạn" }, tone: "muted", icon: Pencil },
  valid: { label: { en: "Valid", vi: "Còn hiệu lực" }, tone: "success", icon: CheckCircle2 },
  expiring: { label: { en: "Renew soon", vi: "Sắp cần gia hạn" }, tone: "warning", icon: Clock },
  expired: { label: { en: "Expired", vi: "Đã hết hạn" }, tone: "danger", icon: AlertTriangle },
};

function LicenseCard({ license, canEdit, onSaved }: { license: License; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(license.expiryDate ?? "");
  const status = getLicenseStatus(license);
  const meta = STATUS_META[status];
  const Icon = meta.icon;

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
      {canEdit && (
        editing ? (
          <div className="mt-2 flex items-center gap-2">
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
                updateLicense(license.id, { expiryDate: date });
                setEditing(false);
                onSaved();
              }}
            >
              Save
            </Button>
            <Button variant="ghost" className="min-h-11 text-sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="mt-2 flex items-center gap-1 text-xs text-brand font-semibold">
            <Pencil size={11} /> {license.expiryDate ? "Update date · Cập nhật ngày" : "Add date · Thêm ngày"}
          </button>
        )
      )}
    </Card>
  );
}

function LicensingContent() {
  const { session } = useSession();
  const [licenses, setLicenses] = useState<License[]>([]);
  const refresh = () => setLicenses(getLicenses());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const canEdit = canEditLicensing(session.role);
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
        <div className="space-y-2">
          {licenses.map((l) => (
            <LicenseCard key={l.id} license={l} canEdit={canEdit} onSaved={refresh} />
          ))}
        </div>
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
