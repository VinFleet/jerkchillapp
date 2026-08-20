"use client";

import { useEffect, useState } from "react";
import { UserRound, Check, ChevronDown } from "lucide-react";
import { useSession, staffFitsStation } from "@/lib/auth/RoleContext";
import { getStaff } from "@/lib/repo/staff";
import type { StaffMember } from "@/lib/types";

/**
 * Who the station is currently logging things as.
 *
 * The tablet stays signed in to the kitchen all service — four chefs share it,
 * and signing in and out per person would be unusable. So this picks the
 * person instead: one tap to open, one to choose. Everything logged from then
 * on carries that name, and the chip stays visible so it's obvious when it's
 * still set to whoever worked the last shift.
 */
export function WhoIsWorking({ compact = false }: { compact?: boolean }) {
  const { session, setActiveStaff } = useSession();
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const unset = !session?.name;

  useEffect(() => {
    if (open || unset) setStaff(getStaff());
  }, [open, unset]);

  // A temperature reading signed by nobody is not a record — an inspector
  // reading "checked by: (blank)" is the same as no check having happened. So
  // the shift can't start until someone is named: this opens on its own and,
  // below, refuses to close while the name is still empty.
  useEffect(() => {
    if (unset) setOpen(true);
  }, [unset]);

  if (!session) return null;

  const choices = staff.filter((s) => staffFitsStation(s, session.station));
  // The one exception — with nobody set up for this station there is nothing
  // to pick, so trapping them here would just be a dead end.
  const dismissible = !unset || choices.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-full font-semibold border-2 ${
          unset
            ? "bg-warning-tint border-warning text-warning"
            : "bg-brand-light border-transparent text-brand"
        } ${compact ? "min-h-11 px-3 text-xs min-w-0 max-w-[10.5rem]" : "min-h-11 px-3.5 text-sm w-full justify-center"}`}
      >
        <UserRound size={15} className="shrink-0" />
        {unset ? (
          <span className="truncate">{compact ? "Pick name · Chọn tên" : "Who's working? · Ai đang làm?"}</span>
        ) : (
          <span className="truncate">{session.name}</span>
        )}
        <ChevronDown size={14} className="shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => dismissible && setOpen(false)}
        >
          <div
            className="bg-surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4 safe-bottom max-h-[80dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-base">Who&apos;s working?</p>
            <p className="text-sm text-muted mb-3">Ai đang làm? — everything logged now uses this name</p>
            {!dismissible && (
              <p className="text-xs text-warning font-semibold mb-3">
                Pick your name to start — checks and logs are signed with it.
                <br />
                Chọn tên để bắt đầu — các mục kiểm tra sẽ ghi tên này.
              </p>
            )}

            <div className="space-y-2">
              {choices.map((member) => {
                const active = member.id === session.activeStaffId;
                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      setActiveStaff(member);
                      setOpen(false);
                    }}
                    className={`w-full min-h-14 rounded-2xl border-2 px-4 flex items-center justify-between gap-2 text-left ${
                      active ? "border-brand bg-brand-light" : "border-border"
                    }`}
                  >
                    <span>
                      <span className="block font-semibold text-sm">{member.name}</span>
                      <span className="block text-xs text-muted">{member.role}</span>
                    </span>
                    {active && <Check size={18} className="text-brand shrink-0" />}
                  </button>
                );
              })}
              {choices.length === 0 && (
                <p className="text-sm text-muted text-center py-6">
                  No staff set up for this station yet — add them under Staff.
                  <br />
                  Chưa có nhân viên cho khu vực này — thêm trong mục Nhân viên.
                </p>
              )}
            </div>

            {dismissible && (
              <button
                onClick={() => setOpen(false)}
                className="w-full min-h-12 mt-3 rounded-2xl border-2 border-border font-semibold text-sm text-muted"
              >
                Close · Đóng
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
