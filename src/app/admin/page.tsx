"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Building2, Plus, Loader2, MapPin, UserPlus, Ban, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { VinposWordmark } from "@/components/VinposWordmark";
import { VietQrCode } from "@/components/VietQrCode";
import { buildVietQrPayload } from "@/lib/payments/vietqr";

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
  billing: { org_id: string; setup_paid_at: string | null; support_until: string | null }[];
};

/**
 * VINPOS's own bank account, for the charge QR a customer scans. Public env
 * on purpose — an account number is what goes on an invoice, not a secret.
 * Unset means the QR button simply does not appear.
 */
const PLATFORM_BANK = {
  bin: process.env.NEXT_PUBLIC_VINPOS_BANK_BIN ?? "",
  account: process.env.NEXT_PUBLIC_VINPOS_BANK_ACCOUNT ?? "",
  name: process.env.NEXT_PUBLIC_VINPOS_BANK_NAME ?? "",
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
  const [billingForm, setBillingForm] = useState({ orgId: "", kind: "support", amountVnd: "", months: "1", reference: "" });
  const [chargeQr, setChargeQr] = useState<{ orgId: string; payload: string; amount: number } | null>(null);

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

              {(() => {
                const bill = overview.billing.find((b) => b.org_id === org.id);
                const today = new Date().toISOString().slice(0, 10);
                const supported = Boolean(bill?.support_until && bill.support_until >= today);
                return (
                  <p className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                    <span className={bill?.setup_paid_at ? "text-success font-semibold" : "text-muted"}>
                      {bill?.setup_paid_at ? "Setup paid" : "Setup unpaid"}
                    </span>
                    <span className={supported ? "text-success font-semibold" : "text-danger font-semibold"}>
                      {bill?.support_until
                        ? `Support until ${bill.support_until}${supported ? "" : " — LAPSED"}`
                        : "No support plan"}
                    </span>
                  </p>
                );
              })()}

              {chargeQr?.orgId === org.id && (
                <div className="rounded-xl border-2 border-brand p-3 text-center space-y-2">
                  <p className="text-sm font-semibold">
                    Customer scans this — {chargeQr.amount.toLocaleString("vi-VN")}₫
                  </p>
                  <VietQrCode payload={chargeQr.payload} size={200} />
                  <p className="text-xs text-muted font-mono">memo: VINPOS {org.id}</p>
                  <button onClick={() => setChargeQr(null)} className="text-xs text-muted">
                    close
                  </button>
                </div>
              )}

              {billingForm.orgId === org.id && (
                <div className="flex flex-wrap gap-2 items-center rounded-xl border border-border p-2">
                  <select
                    value={billingForm.kind}
                    onChange={(e) => setBillingForm({ ...billingForm, kind: e.target.value })}
                    className="min-h-[40px] rounded-lg border border-border px-2 text-sm"
                  >
                    <option value="support">support</option>
                    <option value="setup">setup</option>
                  </select>
                  <input
                    value={billingForm.amountVnd}
                    onChange={(e) => setBillingForm({ ...billingForm, amountVnd: e.target.value.replace(/[^\d]/g, "") })}
                    placeholder="Amount ₫"
                    inputMode="numeric"
                    className="min-h-[40px] w-32 rounded-lg border border-border px-3 text-sm tabular-nums"
                  />
                  {billingForm.kind === "support" && (
                    <input
                      value={billingForm.months}
                      onChange={(e) => setBillingForm({ ...billingForm, months: e.target.value.replace(/[^\d]/g, "") })}
                      placeholder="Months"
                      inputMode="numeric"
                      className="min-h-[40px] w-20 rounded-lg border border-border px-3 text-sm tabular-nums"
                    />
                  )}
                  {PLATFORM_BANK.bin && PLATFORM_BANK.account && (
                    <button
                      onClick={() => {
                        const amount = Number(billingForm.amountVnd || 0);
                        if (!amount) return;
                        try {
                          setChargeQr({
                            orgId: org.id,
                            amount,
                            payload: buildVietQrPayload({
                              bankBin: PLATFORM_BANK.bin,
                              accountNumber: PLATFORM_BANK.account,
                              amountVnd: amount,
                              reference: `VINPOS ${org.id}`.slice(0, 25),
                            }),
                          });
                        } catch {
                          flash("Check NEXT_PUBLIC_VINPOS_BANK_* values");
                        }
                      }}
                      className="min-h-[40px] px-3 rounded-lg border border-brand text-brand text-sm font-semibold"
                    >
                      Show QR
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const res = await adminFetch("/api/admin/billing", {
                        method: "POST",
                        body: JSON.stringify({
                          orgId: org.id,
                          kind: billingForm.kind,
                          amountVnd: Number(billingForm.amountVnd || 0),
                          months: Number(billingForm.months || 0),
                          reference: billingForm.reference || `VINPOS ${org.id}`,
                        }),
                      });
                      const body = await res.json();
                      flash(res.ok ? "Payment recorded" : `Failed: ${body.error}`);
                      setBillingForm({ orgId: "", kind: "support", amountVnd: "", months: "1", reference: "" });
                      setChargeQr(null);
                      void load();
                    }}
                    className="min-h-[40px] px-3 rounded-lg bg-success text-white text-sm font-semibold"
                  >
                    Money arrived
                  </button>
                  <button onClick={() => setBillingForm({ ...billingForm, orgId: "" })} className="min-h-[40px] px-2 text-muted">
                    ✕
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {billingForm.orgId !== org.id && (
                  <button
                    onClick={() => setBillingForm({ ...billingForm, orgId: org.id })}
                    className="min-h-[40px] px-3 rounded-lg border border-border text-xs font-semibold"
                  >
                    ₫ Billing
                  </button>
                )}
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
