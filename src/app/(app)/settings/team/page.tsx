"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, UserPlus, Loader2, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import { supabase } from "@/lib/supabase/client";
import { getActiveTenant } from "@/lib/storage";

/**
 * The restaurant's own people, managed by the restaurant.
 *
 * Managers see who has a login; owners create logins, change roles and
 * remove people. The one thing the API refuses no matter who asks is
 * demoting or removing the last owner — an organization locked out of
 * itself is the state no support call can undo from inside the product.
 */

type Member = { userId: string; role: string; email: string; you: boolean };

async function teamFetch(method: string, params = "", body?: unknown) {
  const { data } = await supabase!.auth.getSession();
  return fetch(`/api/team?branch=${encodeURIComponent(getActiveTenant())}${params}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function TeamContent() {
  const { session } = useSession();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [yourRole, setYourRole] = useState<string>("staff");
  const [denied, setDenied] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "staff" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const res = await teamFetch("GET");
    if (res.status === 401) {
      setDenied(true);
      return;
    }
    if (res.ok) {
      const body = (await res.json()) as { members: Member[]; yourRole: string };
      setMembers(body.members);
      setYourRole(body.yourRole);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session) return null;
  if (denied || (session.role !== "owner" && session.role !== "manager")) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Owners and managers only</p>
        <p className="text-muted text-sm">Chỉ chủ và quản lý</p>
      </div>
    );
  }

  const isOwner = yourRole === "owner";

  const flash = (message: string) => {
    setNote(message);
    window.setTimeout(() => setNote(null), 4000);
  };

  return (
    <div className="pb-10">
      <BackLink href="/settings" label="Settings" />
      <PageHeader
        title="Team · Đội Ngũ"
        subtitle="Logins for this restaurant · Tài khoản đăng nhập"
      />

      <div className="px-4 md:px-8 max-w-xl space-y-3">
        {note && <p className="text-sm rounded-xl bg-brand-light text-brand px-3 py-2">{note}</p>}

        {members === null && (
          <p className="text-center py-8">
            <Loader2 className="animate-spin inline text-muted" />
          </p>
        )}

        {members?.map((member) => (
          <div
            key={member.userId}
            className="rounded-2xl border border-border bg-surface px-4 py-3 flex items-center gap-3"
          >
            <UserRound size={20} className="text-muted shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold truncate">
                {member.email}
                {member.you && <span className="text-brand"> · you · bạn</span>}
              </span>
            </span>
            {isOwner && !member.you ? (
              <>
                <select
                  value={member.role}
                  onChange={async (e) => {
                    const res = await teamFetch("PATCH", "", {
                      userId: member.userId,
                      role: e.target.value,
                    });
                    if (!res.ok) flash((await res.json()).error ?? "Failed");
                    void load();
                  }}
                  className="min-h-[40px] rounded-lg border border-border px-2 text-sm shrink-0"
                >
                  <option value="owner">owner</option>
                  <option value="manager">manager</option>
                  <option value="staff">staff</option>
                </select>
                {confirming === member.userId ? (
                  <button
                    onClick={async () => {
                      const res = await teamFetch("DELETE", `&userId=${member.userId}`);
                      if (!res.ok) flash((await res.json()).error ?? "Failed");
                      setConfirming(null);
                      void load();
                    }}
                    className="min-h-[40px] px-3 rounded-lg bg-danger text-white text-xs font-bold shrink-0"
                  >
                    Remove?
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirming(member.userId)}
                    aria-label="Remove from the team"
                    className="w-10 h-10 rounded-lg grid place-items-center text-muted shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs font-bold text-muted uppercase shrink-0">{member.role}</span>
            )}
          </div>
        ))}

        {isOwner && (
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <UserPlus size={16} className="text-brand" />
              New login <span className="text-muted font-normal">· Tài khoản mới</span>
            </p>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              inputMode="email"
              className="w-full min-h-[48px] rounded-xl border border-border px-3"
            />
            <div className="flex gap-2">
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="First password (8+) · Mật khẩu đầu"
                className="flex-1 min-w-0 min-h-[48px] rounded-xl border border-border px-3"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="min-h-[48px] rounded-xl border border-border px-2 shrink-0"
              >
                <option value="staff">staff</option>
                <option value="manager">manager</option>
                <option value="owner">owner</option>
              </select>
            </div>
            <p className="text-xs text-muted">
              Managers can open the manager station; staff sign in to kitchen and floor stations. ·
              Quản lý mở được trạm quản lý.
            </p>
            <button
              onClick={async () => {
                setBusy(true);
                const res = await teamFetch("POST", "", form);
                setBusy(false);
                if (res.ok) {
                  flash("Login created — hand it over · Đã tạo, gửi cho nhân viên");
                  setForm({ email: "", password: "", role: "staff" });
                  void load();
                } else {
                  flash((await res.json()).error ?? "Failed");
                }
              }}
              disabled={busy || !form.email.trim() || form.password.length < 8}
              className="w-full min-h-[48px] rounded-xl bg-brand text-white font-semibold disabled:bg-border disabled:text-muted flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Create · Tạo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  return <TeamContent />;
}
