"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Building2, Plus, Loader2, MapPin, UserPlus, Ban, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { VinposWordmark } from "@/components/VinposWordmark";

/**
 * The platform console — VINPOS's side of the counter.
 *
 * Everything here goes through the admin API with the caller's own session
 * token; the browser never holds anything stronger. Creating a restaurant is
 * one form because half a restaurant is not a deliverable: the org, its
 * first branch and the owner's login come back together, ready to hand over.
 */

type Overview = {
  orgs: { id: string; name: string; active: boolean }[];
  branches: { id: string; org_id: string; name: string }[];
  members: { org_id: string; user_id: string; role: string }[];
};

async function adminFetch(path: string, init?: RequestInit) {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
  });
}

export default function AdminPage() {
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: "", branchName: "", ownerEmail: "", ownerPassword: "" });
  const [userForm, setUserForm] = useState({ orgId: "", email: "", password: "", role: "manager" });
  const [branchForm, setBranchForm] = useState({ orgId: "", name: "" });

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/orgs");
    if (res.status === 401) {
      setState("denied");
      return;
    }
    if (res.ok) {
      setOverview((await res.json()) as Overview);
      setState("ok");
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setState("denied");
      return;
    }
    void load();
  }, [load]);

  if (state === "checking") {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="animate-spin text-muted" />
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="min-h-dvh grid place-items-center bg-background p-6">
        <div className="text-center">
          <ShieldAlert size={40} className="text-muted mx-auto mb-3" />
          <p className="font-semibold">Platform admins only</p>
          <p className="text-sm text-muted">
            Sign in on the main app first, with an account listed in platform_admins.
          </p>
        </div>
      </div>
    );
  }

  const flash = (message: string) => {
    setNote(message);
    window.setTimeout(() => setNote(null), 4000);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-surface border-b border-border px-5 py-4 flex items-center gap-3">
        <VinposWordmark />
        <span className="text-sm text-muted">Platform console</span>
      </header>

      <main className="max-w-3xl mx-auto p-5 space-y-6 pb-16">
        {note && (
          <p className="text-sm rounded-xl bg-success-tint text-success px-3 py-2">{note}</p>
        )}

        {/* New restaurant */}
        <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2">
            <Building2 size={18} className="text-brand" /> New restaurant
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Restaurant name"
              className="min-h-[48px] rounded-xl border border-border px-3"
            />
            <input
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              placeholder="First branch — e.g. District 1"
              className="min-h-[48px] rounded-xl border border-border px-3"
            />
            <input
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              placeholder="Owner's email"
              inputMode="email"
              className="min-h-[48px] rounded-xl border border-border px-3"
            />
            <input
              value={form.ownerPassword}
              onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
              placeholder="Owner's first password (8+)"
              className="min-h-[48px] rounded-xl border border-border px-3"
            />
          </div>
          <button
            onClick={async () => {
              setBusy(true);
              const res = await adminFetch("/api/admin/orgs", {
                method: "POST",
                body: JSON.stringify(form),
              });
              setBusy(false);
              const body = await res.json();
              if (res.ok) {
                flash(`Created ${body.orgId} — hand the owner their login and the app URL.`);
                setForm({ name: "", branchName: "", ownerEmail: "", ownerPassword: "" });
                void load();
              } else {
                flash(`Failed: ${body.error}`);
              }
            }}
            disabled={busy}
            className="min-h-[48px] px-5 rounded-xl bg-brand text-white font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Create restaurant
          </button>
        </section>

        {/* Existing orgs */}
        {overview?.orgs.map((org) => {
          const branches = overview.branches.filter((b) => b.org_id === org.id);
          const members = overview.members.filter((m) => m.org_id === org.id);
          return (
            <section
              key={org.id}
              className={`rounded-2xl border border-border bg-surface p-4 space-y-2 ${org.active ? "" : "opacity-60"}`}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-bold flex-1">
                  {org.name}{" "}
                  <span className="text-muted font-mono text-xs font-normal">{org.id}</span>
                  {!org.active && (
                    <span className="ml-2 text-xs font-bold text-danger">SUSPENDED</span>
                  )}
                </h3>
                <button
                  onClick={async () => {
                    const res = await adminFetch("/api/admin/orgs", {
                      method: "PATCH",
                      body: JSON.stringify({ orgId: org.id, active: !org.active }),
                    });
                    if (res.ok) void load();
                  }}
                  className={`min-h-[40px] px-3 rounded-lg border text-xs font-bold flex items-center gap-1 ${
                    org.active ? "border-danger text-danger" : "border-success text-success"
                  }`}
                >
                  {org.active ? <Ban size={13} /> : <Check size={13} />}
                  {org.active ? "Suspend" : "Restore"}
                </button>
              </div>

              <p className="text-xs text-muted">
                {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
                {members.filter((m) => m.role === "owner").length} owner
              </p>

              <div className="space-y-1">
                {branches.map((b) => (
                  <p key={b.id} className="text-sm flex items-center gap-2">
                    <MapPin size={13} className="text-muted shrink-0" />
                    {b.name} <span className="text-muted font-mono text-xs">{b.id}</span>
                  </p>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {branchForm.orgId === org.id ? (
                  <>
                    <input
                      value={branchForm.name}
                      onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                      autoFocus
                      placeholder="Branch name"
                      className="min-h-[40px] rounded-lg border border-border px-3 text-sm"
                    />
                    <button
                      onClick={async () => {
                        const res = await adminFetch("/api/admin/branches", {
                          method: "POST",
                          body: JSON.stringify(branchForm),
                        });
                        const body = await res.json();
                        flash(res.ok ? `Branch ${body.branchId} created` : `Failed: ${body.error}`);
                        setBranchForm({ orgId: "", name: "" });
                        void load();
                      }}
                      className="min-h-[40px] px-3 rounded-lg bg-brand text-white text-sm font-semibold"
                    >
                      Add
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setBranchForm({ orgId: org.id, name: "" })}
                    className="min-h-[40px] px-3 rounded-lg border border-border text-xs font-semibold flex items-center gap-1"
                  >
                    <MapPin size={13} /> Add branch
                  </button>
                )}

                {userForm.orgId === org.id ? (
                  <span className="flex flex-wrap gap-2">
                    <input
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="Email"
                      className="min-h-[40px] rounded-lg border border-border px-3 text-sm"
                    />
                    <input
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="Password (8+)"
                      className="min-h-[40px] rounded-lg border border-border px-3 text-sm w-32"
                    />
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="min-h-[40px] rounded-lg border border-border px-2 text-sm"
                    >
                      <option value="owner">owner</option>
                      <option value="manager">manager</option>
                      <option value="staff">staff</option>
                    </select>
                    <button
                      onClick={async () => {
                        const res = await adminFetch("/api/admin/users", {
                          method: "POST",
                          body: JSON.stringify(userForm),
                        });
                        const body = await res.json();
                        flash(res.ok ? "Login created — hand it over." : `Failed: ${body.error}`);
                        setUserForm({ orgId: "", email: "", password: "", role: "manager" });
                        void load();
                      }}
                      className="min-h-[40px] px-3 rounded-lg bg-brand text-white text-sm font-semibold"
                    >
                      Create
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setUserForm({ ...userForm, orgId: org.id })}
                    className="min-h-[40px] px-3 rounded-lg border border-border text-xs font-semibold flex items-center gap-1"
                  >
                    <UserPlus size={13} /> Add login
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
