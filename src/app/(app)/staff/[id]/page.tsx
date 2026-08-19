"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CheckCircle2, Plus, UserMinus, RotateCcw } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BigCheckbox } from "@/components/ui/BigCheckbox";
import { useSession } from "@/lib/auth/RoleContext";
import { canSeeWages, canEditStaff } from "@/lib/auth/permissions";
import {
  getStaffMember,
  updateStaffMember,
  setStaffActive,
  getInductionCompletion,
  isInductionStepDone,
  toggleInductionStep,
  getConductAck,
  ackConduct,
  getTrainingRecords,
  logTraining,
  getHealthCert,
  updateHealthCert,
  getDisciplinaryEntries,
  logDisciplinary,
} from "@/lib/repo/staff";
import {
  INDUCTION_STEP_LABEL,
  DISCIPLINARY_LEVEL_LABEL,
  DISCIPLINARY_LEVEL_SHORT,
  STAFF_ROLES,
  isStaffRole,
  staffRoleLabel,
} from "@/lib/staffLabels";
import { INDUCTION_STEPS } from "@/lib/types";
import type { StaffMember, TrainingRecord, DisciplinaryEntry, DisciplinaryLevel } from "@/lib/types";
import { CODE_OF_CONDUCT, DISCIPLINARY_POLICY } from "@/lib/staffPolicy";

const DAY_OFF_LABEL: Record<string, { en: string; vi: string }> = {
  mon: { en: "Monday", vi: "Thứ Hai" },
  tue: { en: "Tuesday", vi: "Thứ Ba" },
  wed: { en: "Wednesday", vi: "Thứ Tư" },
  thu: { en: "Thursday", vi: "Thứ Năm" },
  fri: { en: "Friday", vi: "Thứ Sáu" },
  sat: { en: "Saturday", vi: "Thứ Bảy" },
  sun: { en: "Sunday", vi: "Chủ Nhật" },
};

function DetailsSection({ staff, canEdit, onSaved }: { staff: StaffMember; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(staff.role);
  const [email, setEmail] = useState(staff.email ?? "");

  // A role saved as free text before the fixed list existed stays selectable,
  // so editing the email can't silently rewrite someone's job.
  const roleOptions: string[] = isStaffRole(staff.role) ? [...STAFF_ROLES] : [staff.role, ...STAFF_ROLES];

  const startEditing = () => {
    setRole(staff.role);
    setEmail(staff.email ?? "");
    setEditing(true);
  };

  if (editing) {
    return (
      <Card>
        <p className="font-semibold text-sm mb-2">Details · Thông tin</p>
        <label className="text-xs text-muted">Role · Vai trò</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm bg-surface focus:outline-none focus:border-brand"
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {staffRoleLabel(r).en} · {staffRoleLabel(r).vi}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted">Email — for the emailed rota · Email — để gửi lịch làm</label>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-3 mt-1 text-sm focus:outline-none focus:border-brand"
        />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={() => setEditing(false)}>
            Cancel · Hủy
          </Button>
          <Button
            className="flex-1 min-h-11 text-sm"
            onClick={() => {
              updateStaffMember(staff.id, { role, email: email.trim() || undefined });
              setEditing(false);
              onSaved();
            }}
          >
            Save · Lưu
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="font-semibold text-sm mb-2">Details · Thông tin</p>
      <p className="text-sm">
        <Bi value={staffRoleLabel(staff.role)} mode="inline" />
      </p>
      <p className="text-sm mt-1">{staff.email ?? "No email on file · Chưa có email"}</p>
      {canEdit && (
        <button onClick={startEditing} className="mt-2 text-xs text-brand font-semibold">
          Edit · Sửa
        </button>
      )}
    </Card>
  );
}

function EmploymentSection({ staff, onChanged }: { staff: StaffMember; onChanged: () => void }) {
  return (
    <Card>
      <p className="font-semibold text-sm mb-2">Employment · Trạng thái làm việc</p>
      {staff.active ? (
        <>
          <p className="text-sm mb-1">Active — on the rota, wages and reminders.</p>
          <p className="text-sm text-muted mb-3">Đang làm việc — có trong lịch làm, bảng lương và nhắc nhở.</p>
          <Button
            variant="danger"
            className="w-full min-h-12 text-sm"
            onClick={() => {
              if (
                window.confirm(
                  `Deactivate ${staff.name}? They come off the rota and wages, but all records are kept. · Ngừng làm việc với ${staff.name}? Sẽ bỏ khỏi lịch làm và bảng lương, hồ sơ vẫn được giữ.`
                )
              ) {
                setStaffActive(staff.id, false);
                onChanged();
              }
            }}
          >
            <UserMinus size={16} /> Deactivate · Ngừng làm việc
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm mb-1">Deactivated — off the rota, wages and reminders. Records kept.</p>
          <p className="text-sm text-muted mb-3">Đã ngừng làm việc — không có trong lịch làm, bảng lương và nhắc nhở. Hồ sơ vẫn được giữ.</p>
          <Button
            variant="secondary"
            className="w-full min-h-12 text-sm"
            onClick={() => {
              setStaffActive(staff.id, true);
              onChanged();
            }}
          >
            <RotateCcw size={16} /> Reactivate · Nhận lại làm việc
          </Button>
        </>
      )}
    </Card>
  );
}

function InductionSection({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [, setTick] = useState(0);
  const { done, total } = getInductionCompletion(staffId);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm">Induction · Đào tạo nhập môn</p>
        <Badge tone={done === total ? "success" : "muted"}>
          {done}/{total}
        </Badge>
      </div>
      <div className="space-y-2">
        {INDUCTION_STEPS.map((step) => (
          <BigCheckbox
            key={step}
            label={INDUCTION_STEP_LABEL[step]}
            checked={isInductionStepDone(staffId, step)}
            onToggle={() => {
              toggleInductionStep(staffId, step, staffName);
              setTick((t) => t + 1);
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function ConductSection({ staffId }: { staffId: string }) {
  const [, setTick] = useState(0);
  const ack = getConductAck(staffId);

  return (
    <Card>
      <p className="font-semibold text-sm mb-2">Code of Conduct · Quy Tắc Ứng Xử</p>
      <ul className="list-disc pl-4 mb-3 space-y-2">
        {CODE_OF_CONDUCT.map((rule, i) => (
          <li key={i}>
            <span className="block text-sm">{rule.en}</span>
            <span className="block text-sm text-muted">{rule.vi}</span>
          </li>
        ))}
      </ul>
      {ack ? (
        <p className="text-sm text-success flex items-center gap-2">
          <CheckCircle2 size={16} /> Acknowledged · Đã xác nhận {new Date(ack.ackedAt).toLocaleDateString()}
        </p>
      ) : (
        <Button
          variant="secondary"
          className="min-h-11 text-sm"
          onClick={() => {
            ackConduct(staffId);
            setTick((t) => t + 1);
          }}
        >
          Mark acknowledged · Đánh dấu đã xác nhận
        </Button>
      )}
    </Card>
  );
}

function HealthCertSection({ staffId }: { staffId: string }) {
  const [editing, setEditing] = useState(false);
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewedOn, setRenewedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [, setTick] = useState(0);
  const cert = getHealthCert(staffId);

  const startEditing = () => {
    setIssueDate(cert.issueDate ?? "");
    setExpiryDate(cert.expiryDate ?? "");
    setRenewedOn(cert.renewedOn ?? "");
    setNotes(cert.notes ?? "");
    setEditing(true);
  };

  if (editing) {
    return (
      <Card>
        <p className="font-semibold text-sm mb-2">Health Certificate · Giấy Khám Sức Khỏe</p>
        <label className="text-xs text-muted">Issue date · Ngày cấp</label>
        <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm" />
        <label className="text-xs text-muted">Expiry (annual) · Hết hạn (hàng năm)</label>
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm" />
        <label className="text-xs text-muted">Renewed on · Ngày gia hạn</label>
        <input type="date" value={renewedOn} onChange={(e) => setRenewedOn(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm" />
        <label className="text-xs text-muted">Notes · Ghi chú</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-3 mt-1 text-sm" />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={() => setEditing(false)}>
            Cancel · Hủy
          </Button>
          <Button
            className="flex-1 min-h-11 text-sm"
            onClick={() => {
              updateHealthCert(staffId, {
                issueDate: issueDate || undefined,
                expiryDate: expiryDate || null,
                renewedOn: renewedOn || undefined,
                notes: notes.trim() || undefined,
              });
              setEditing(false);
              setTick((t) => t + 1);
            }}
          >
            Save · Lưu
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="font-semibold text-sm mb-2">Health Certificate · Giấy Khám Sức Khỏe</p>
      <p className="text-sm">
        {cert.expiryDate ? `Expires · Hết hạn ${cert.expiryDate}` : "No date on file · Chưa có ngày"}
      </p>
      {cert.issueDate && <p className="text-xs text-muted mt-1">Issued · Ngày cấp {cert.issueDate}</p>}
      {cert.renewedOn && <p className="text-xs text-muted">Renewed · Gia hạn {cert.renewedOn}</p>}
      {cert.notes && <p className="text-xs text-muted mt-1">{cert.notes}</p>}
      <button onClick={startEditing} className="mt-2 text-xs text-brand font-semibold">
        {cert.expiryDate ? "Update · Cập nhật" : "Add date · Thêm ngày"}
      </button>
    </Card>
  );
}

function TrainingSection({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [refresherDue, setRefresherDue] = useState("");
  const [trainer, setTrainer] = useState("");
  const refresh = () => setRecords(getTrainingRecords(staffId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  return (
    <Card>
      <p className="font-semibold text-sm mb-2">Training Record · Hồ Sơ Đào Tạo</p>
      {open ? (
        <div className="mb-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic · Nội dung"
            className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
          />
          <label className="text-xs text-muted">Refresher due · Hạn đào tạo lại</label>
          <input
            type="date"
            value={refresherDue}
            onChange={(e) => setRefresherDue(e.target.value)}
            className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 mt-1 text-sm focus:outline-none focus:border-brand"
          />
          <input
            value={trainer}
            onChange={(e) => setTrainer(e.target.value)}
            placeholder="Trainer · Người đào tạo"
            className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={() => setOpen(false)}>
              Cancel · Hủy
            </Button>
            <Button
              className="flex-1 min-h-11 text-sm"
              disabled={!topic.trim()}
              onClick={() => {
                logTraining(staffId, topic.trim(), staffName, refresherDue || undefined, trainer.trim() || undefined);
                setTopic("");
                setRefresherDue("");
                setTrainer("");
                setOpen(false);
                refresh();
              }}
            >
              Save · Lưu
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full min-h-11 rounded-xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-3 text-sm"
        >
          <Plus size={16} /> Add training · Thêm đào tạo
        </button>
      )}
      <div className="space-y-2">
        {records.map((r) => (
          <div key={r.id} className="text-sm pb-2 border-b border-border last:border-0 last:pb-0">
            <p>
              {r.date} — {r.topic}
            </p>
            {(r.trainer || r.refresherDue) && (
              <p className="text-xs text-muted">
                {r.trainer && `Trainer · Người đào tạo: ${r.trainer}`}
                {r.trainer && r.refresherDue && " · "}
                {r.refresherDue && `Refresher due · Hạn đào tạo lại ${r.refresherDue}`}
              </p>
            )}
          </div>
        ))}
        {records.length === 0 && <p className="text-muted text-sm">No training logged yet · Chưa có đào tạo</p>}
      </div>
    </Card>
  );
}

function DisciplinarySection({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [entries, setEntries] = useState<DisciplinaryEntry[]>([]);
  const [level, setLevel] = useState<DisciplinaryLevel>("verbal");
  const [detail, setDetail] = useState("");
  const refresh = () => setEntries(getDisciplinaryEntries(staffId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  return (
    <Card>
      <p className="font-semibold text-sm mb-2">Disciplinary Log · Nhật Ký Kỷ Luật</p>
      <div className="mb-3 rounded-xl bg-brand-light/50 p-3">
        <p className="text-sm">{DISCIPLINARY_POLICY.en}</p>
        <p className="text-sm text-muted mt-1">{DISCIPLINARY_POLICY.vi}</p>
      </div>
      <div className="flex gap-2 mb-2">
        {(["verbal", "written", "final"] as DisciplinaryLevel[]).map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`flex-1 min-h-12 px-1 rounded-2xl text-xs font-semibold leading-tight border-2 ${
              level === l ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {DISCIPLINARY_LEVEL_SHORT[l].en}
            <br />
            {DISCIPLINARY_LEVEL_SHORT[l].vi}
          </button>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Detail · Chi tiết"
        rows={2}
        className="w-full rounded-xl border-2 border-border px-3 py-2 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <Button
        className="min-h-11 text-sm mb-3"
        disabled={!detail.trim()}
        onClick={() => {
          logDisciplinary(staffId, level, detail.trim(), staffName);
          setDetail("");
          refresh();
        }}
      >
        Log entry · Ghi nhận
      </Button>
      <div className="space-y-2 pt-2 border-t border-border">
        {entries.map((e) => (
          <div key={e.id}>
            <p className="text-sm font-semibold">
              <Bi value={DISCIPLINARY_LEVEL_LABEL[e.level]} mode="inline" /> — {e.date}
            </p>
            <p className="text-sm text-muted">{e.detail}</p>
          </div>
        ))}
        {entries.length === 0 && <p className="text-muted text-sm">No entries · Chưa có mục nào</p>}
      </div>
    </Card>
  );
}

function StaffDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { session } = useSession();
  const [staff, setStaff] = useState<StaffMember | null | undefined>(undefined);
  const [rateEditing, setRateEditing] = useState(false);
  const [rate, setRate] = useState("");
  const refreshStaff = () => setStaff(getStaffMember(id) ?? null);

  useEffect(() => {
    const s = getStaffMember(id);
    setStaff(s ?? null);
    setRate(s?.hourlyRateVnd ? String(s.hourlyRateVnd) : "");
  }, [id]);

  if (!session || staff === undefined) return null;
  if (staff === null) {
    return <div className="p-6 text-center text-muted">Staff member not found · Không tìm thấy nhân viên</div>;
  }

  const canEdit = canEditStaff(session.role);
  const wagesAllowed = canSeeWages(session.role);

  return (
    <div className="pb-10">
      <div className="px-4 md:px-8 pt-4 flex items-center gap-2">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-brand">
          <ChevronLeft size={24} />
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{staff.name}</h1>
            {!staff.active && <Badge tone="muted">Left · Đã nghỉ</Badge>}
          </div>
          <p className="text-muted text-sm">
            <Bi value={staffRoleLabel(staff.role)} mode="inline" />
            {staff.dayOff && ` · Day off ${DAY_OFF_LABEL[staff.dayOff].en} / Ngày nghỉ ${DAY_OFF_LABEL[staff.dayOff].vi}`}
          </p>
        </div>
      </div>

      <div className="px-4 md:px-8 mt-4 space-y-4">
        <DetailsSection staff={staff} canEdit={canEdit} onSaved={refreshStaff} />

        {wagesAllowed && (
          <Card>
            <p className="font-semibold text-sm mb-2">Hourly rate · Lương theo giờ</p>
            {rateEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-32 min-h-11 rounded-xl border-2 border-border px-3 text-sm"
                />
                <span className="text-sm text-muted">₫/h</span>
                <Button
                  className="min-h-11 text-sm"
                  onClick={() => {
                    updateStaffMember(staff.id, { hourlyRateVnd: Number(rate) || undefined });
                    refreshStaff();
                    setRateEditing(false);
                  }}
                >
                  Save · Lưu
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-bold">{staff.hourlyRateVnd ? `${staff.hourlyRateVnd.toLocaleString("vi-VN")}₫/h` : "Not set · Chưa đặt"}</span>
                <button onClick={() => setRateEditing(true)} className="text-xs text-brand font-semibold">
                  Edit · Sửa
                </button>
              </div>
            )}
          </Card>
        )}

        <InductionSection staffId={staff.id} staffName={session.name} />
        <ConductSection staffId={staff.id} />
        <TrainingSection staffId={staff.id} staffName={session.name} />
        <HealthCertSection staffId={staff.id} />
        {canEdit && <DisciplinarySection staffId={staff.id} staffName={session.name} />}
        {canEdit && <EmploymentSection staff={staff} onChanged={refreshStaff} />}
      </div>
    </div>
  );
}

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  return (
    <RoleGate module="staff">
      <StaffDetailContent id={id} />
    </RoleGate>
  );
}
