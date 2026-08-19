"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight, UserPlus, ChevronLeft } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/RoleContext";
import { canSeeWages, canEditStaff } from "@/lib/auth/permissions";
import {
  getStaff,
  addStaffMember,
  getShiftsForWeek,
  setShift,
  removeShift,
  shiftHours,
  weekDatesFrom,
  mondayOf,
} from "@/lib/repo/staff";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { StaffMember } from "@/lib/types";

type Tab = "directory" | "rota" | "wages";

const DAY_LABEL = [
  { en: "Mon", vi: "T2" },
  { en: "Tue", vi: "T3" },
  { en: "Wed", vi: "T4" },
  { en: "Thu", vi: "T5" },
  { en: "Fri", vi: "T6" },
  { en: "Sat", vi: "T7" },
  { en: "Sun", vi: "CN" },
];

function AddStaffForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add staff · Thêm nhân viên
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New staff member · Nhân viên mới</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name · Tên"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role · Vai trò (e.g. Chef / Kitchen)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim() || !role.trim()}
          onClick={() => {
            addStaffMember(name.trim(), role.trim());
            setName("");
            setRole("");
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

function DirectoryTab({ staff, canEdit, onAdded }: { staff: StaffMember[]; canEdit: boolean; onAdded: () => void }) {
  return (
    <div>
      {canEdit && <AddStaffForm onAdded={onAdded} />}
      <div className="space-y-2">
        {staff.map((s) => (
          <Link key={s.id} href={`/staff/${s.id}`}>
            <Card className="flex items-center justify-between gap-3 active:bg-brand-light transition-colors">
              <div>
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-xs text-muted">{s.role}</p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </Card>
          </Link>
        ))}
        {staff.length === 0 && <p className="text-muted text-center py-10 text-sm">No staff yet · Chưa có nhân viên</p>}
      </div>
    </div>
  );
}

function WeekNav({ monday, onChange }: { monday: string; onChange: (m: string) => void }) {
  const shift = (days: number) => onChange(addDaysIso(monday, days));
  const dates = weekDatesFrom(monday);
  return (
    <div className="flex items-center gap-2 mb-4">
      <button onClick={() => shift(-7)} className="p-2 text-brand" aria-label="Previous week">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {dates[0]} – {dates[6]}
      </span>
      <button onClick={() => shift(7)} className="p-2 text-brand" aria-label="Next week">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function ShiftCell({
  staffId,
  date,
  canEdit,
  onChanged,
}: {
  staffId: string;
  date: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const shifts = getShiftsForWeek(staffId, [date]);
  const shift = shifts[0];

  if (editing) {
    return (
      <div className="flex flex-col gap-1 p-1">
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="text-xs border border-border rounded px-1 py-0.5" />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="text-xs border border-border rounded px-1 py-0.5" />
        <div className="flex gap-1">
          <button
            className="flex-1 text-[10px] bg-brand text-white rounded py-0.5"
            onClick={() => {
              setShift(staffId, date, start, end);
              setEditing(false);
              onChanged();
            }}
          >
            Save
          </button>
          <button className="flex-1 text-[10px] border border-border rounded py-0.5" onClick={() => setEditing(false)}>
            X
          </button>
        </div>
      </div>
    );
  }

  if (shift) {
    return (
      <button
        disabled={!canEdit}
        onClick={() => {
          if (window.confirm("Remove this shift? · Xóa ca này?")) {
            removeShift(staffId, date);
            onChanged();
          }
        }}
        className="w-full h-full min-h-14 rounded-lg bg-brand-light text-brand text-[11px] font-semibold p-1"
      >
        {shift.startTime}–{shift.endTime}
        <br />
        {shiftHours(shift).toFixed(1)}h
      </button>
    );
  }

  return canEdit ? (
    <button onClick={() => setEditing(true)} className="w-full h-full min-h-14 rounded-lg border border-dashed border-border text-muted text-lg">
      +
    </button>
  ) : (
    <div className="w-full h-full min-h-14" />
  );
}

function RotaTab({ staff, canEdit }: { staff: StaffMember[]; canEdit: boolean }) {
  const [monday, setMonday] = useState(mondayOf(todayIso()));
  const [, setRefreshKey] = useState(0);
  const dates = weekDatesFrom(monday);
  const onChanged = () => setRefreshKey((k) => k + 1);

  return (
    <div>
      <WeekNav monday={monday} onChange={setMonday} />
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="border-collapse w-full min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted font-semibold pb-2 pr-2 sticky left-0 bg-background">Staff</th>
              {dates.map((d, i) => (
                <th key={d} className="text-xs text-muted font-semibold pb-2 px-1 text-center">
                  {DAY_LABEL[i].en}
                  <br />
                  {d.slice(5)}
                </th>
              ))}
              <th className="text-xs text-muted font-semibold pb-2 px-1 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const weekShifts = getShiftsForWeek(s.id, dates);
              const total = weekShifts.reduce((sum, sh) => sum + shiftHours(sh), 0);
              return (
                <tr key={s.id}>
                  <td className="text-sm font-semibold py-1 pr-2 sticky left-0 bg-background whitespace-nowrap">{s.name}</td>
                  {dates.map((d) => (
                    <td key={d} className="p-1 align-top">
                      <ShiftCell staffId={s.id} date={d} canEdit={canEdit} onChanged={onChanged} />
                    </td>
                  ))}
                  <td className="text-center text-sm font-bold tabular-nums">{total.toFixed(1)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WagesTab({ staff }: { staff: StaffMember[] }) {
  const [monday, setMonday] = useState(mondayOf(todayIso()));
  const dates = weekDatesFrom(monday);

  const rows = staff.map((s) => {
    const weekShifts = getShiftsForWeek(s.id, dates);
    const hours = weekShifts.reduce((sum, sh) => sum + shiftHours(sh), 0);
    const rate = s.hourlyRateVnd ?? null;
    const wage = rate !== null ? hours * rate : null;
    return { staff: s, hours, rate, wage };
  });

  const total = rows.reduce((sum, r) => sum + (r.wage ?? 0), 0);

  return (
    <div>
      <WeekNav monday={monday} onChange={setMonday} />
      <Card className="p-0 divide-y divide-border">
        <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-muted font-semibold">
          <span>Staff</span>
          <span className="text-center">Hours</span>
          <span className="text-center">Rate/h</span>
          <span className="text-right">Wage</span>
        </div>
        {rows.map(({ staff: s, hours, rate, wage }) => (
          <div key={s.id} className="grid grid-cols-4 gap-2 px-4 py-3 items-center">
            <span className="text-sm font-semibold">{s.name}</span>
            <span className="text-center tabular-nums text-sm">{hours.toFixed(1)}</span>
            <span className="text-center tabular-nums text-sm">{rate ? rate.toLocaleString("vi-VN") : "—"}</span>
            <span className="text-right font-bold tabular-nums text-sm">
              {wage !== null ? `${Math.round(wage).toLocaleString("vi-VN")}₫` : <span className="text-warning text-xs">No rate set</span>}
            </span>
          </div>
        ))}
      </Card>
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="font-bold text-sm">Total · Tổng cộng</span>
        <span className="font-bold text-lg text-brand">{Math.round(total).toLocaleString("vi-VN")}₫</span>
      </div>
    </div>
  );
}

function StaffContent() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const refresh = () => setStaff(getStaff());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const wagesAllowed = canSeeWages(session.role);
  const canEdit = canEditStaff(session.role);

  return (
    <div className="pb-6">
      <PageHeader title="Staff · Nhân Viên" subtitle="Rota, wages, records · Lịch làm, lương, hồ sơ" />
      <div className="px-4 md:px-8">
        <Link href="/staff/hiring">
          <Card className="mb-4 flex items-center gap-3 border-brand/30 active:bg-brand-light transition-colors">
            <UserPlus size={20} className="text-brand shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Hiring & Recruitment · Tuyển Dụng</p>
              <p className="text-xs text-muted">Candidates, question bank, scorecards</p>
            </div>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </Card>
        </Link>

        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            ["directory", "Directory · Danh sách"],
            ["rota", "Rota · Lịch làm"],
            ...(wagesAllowed ? [["wages", "Wages · Lương"] as [Tab, string]] : []),
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

        {tab === "directory" && <DirectoryTab staff={staff} canEdit={canEdit} onAdded={refresh} />}
        {tab === "rota" && <RotaTab staff={staff} canEdit={canEdit} />}
        {tab === "wages" && wagesAllowed && <WagesTab staff={staff} />}
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <RoleGate module="staff">
      <StaffContent />
    </RoleGate>
  );
}
