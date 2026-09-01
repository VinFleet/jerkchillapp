"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, MapPin, Check, Plus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import { getActiveTenant } from "@/lib/storage";
import {
  getMyOrganization,
  getMyBranches,
  createBranch,
  switchBranch,
  todaysTakingsByBranch,
  getMyBilling,
  type Branch,
  type Organization,
} from "@/lib/repo/branches";
import { todayIso } from "@/lib/storage";

/**
 * Where a multi-location owner stands.
 *
 * Deliberately small: list the branches, say which one this device is on,
 * switch, add. Reports that look across branches belong to their own screens
 * later; this is the steering wheel, not the dashboard.
 */

function BranchesContent() {
  const { session } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const active = getActiveTenant();
  const [takings, setTakings] = useState<Record<string, number>>({});
  const [billing, setBilling] = useState<{ setupPaidAt: string | null; supportUntil: string | null; packageName: string | null } | null>(null);

  const load = useCallback(() => {
    void getMyOrganization().then(setOrg);
    void getMyBranches().then(setBranches);
    void todaysTakingsByBranch(todayIso()).then(setTakings);
    void getMyBilling().then(setBilling);
  }, []);

  useEffect(() => load(), [load]);

  if (!session) return null;
  if (session.role !== "owner") {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Owner only</p>
        <p className="text-muted text-sm">Chỉ dành cho chủ nhà hàng</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <BackLink href="/settings" label="Settings" />
      <PageHeader
        title="Branches · Chi Nhánh"
        subtitle={org ? org.name : "Locations of this restaurant · Các địa điểm"}
      />

      <div className="px-4 md:px-8 max-w-xl space-y-3">
        {billing && (
          <p className="text-xs rounded-xl border border-border px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
            <span className={billing.setupPaidAt ? "text-success font-semibold" : "text-muted"}>
              {billing.setupPaidAt ? "Setup complete · Đã cài đặt" : "Setup pending · Chờ cài đặt"}
            </span>
            <span
              className={
                billing.supportUntil && billing.supportUntil >= todayIso()
                  ? "text-success font-semibold"
                  : "text-warning font-semibold"
              }
            >
              {billing.supportUntil
                ? `${billing.packageName ?? "VINPOS"} support until · Hỗ trợ đến ${billing.supportUntil}`
                : "No support plan · Chưa có gói hỗ trợ"}
            </span>
          </p>
        )}
        {branches.length === 0 && (
          <p className="text-sm text-muted rounded-xl border border-border px-4 py-3">
            No branches visible. Run supabase/saas-schema.sql once, then reload — this device&apos;s
            restaurant becomes the first branch automatically.
            <br />
            Chưa thấy chi nhánh — chạy saas-schema.sql một lần rồi tải lại.
          </p>
        )}

        {branches.map((branch) => {
          const current = branch.id === active;
          return (
            <button
              key={branch.id}
              onClick={() => switchBranch(branch.id)}
              disabled={current}
              className={`w-full min-h-[64px] rounded-2xl border-2 px-4 flex items-center gap-3 text-left ${
                current ? "border-brand bg-brand-light" : "border-border"
              }`}
            >
              <MapPin size={20} className={current ? "text-brand" : "text-muted"} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-sm">{branch.name}</span>
                <span className="block text-xs text-muted font-mono truncate">{branch.id}</span>
                {takings[branch.id] !== undefined && (
                  <span className="block text-xs font-bold tabular-nums mt-0.5">
                    Today · Hôm nay: {takings[branch.id].toLocaleString("vi-VN")}₫
                  </span>
                )}
              </span>
              {current ? (
                <span className="text-xs font-bold text-brand flex items-center gap-1 shrink-0">
                  <Check size={14} /> This device · Máy này
                </span>
              ) : (
                <span className="text-xs text-muted shrink-0">Switch · Chuyển</span>
              )}
            </button>
          );
        })}

        {adding ? (
          <div className="rounded-2xl border border-border p-3 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Branch name — e.g. District 7 · Tên chi nhánh"
              className="w-full min-h-[52px] rounded-xl border border-border px-4"
            />
            <p className="text-xs text-muted">
              A new branch starts empty — its own menu, floor plan, printers and settings, seeded
              like a fresh install. · Chi nhánh mới bắt đầu trống, tự tạo dữ liệu mẫu.
            </p>
            {problem && <p className="text-xs text-warning">{problem}</p>}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!org || !name.trim()) return;
                  setBusy(true);
                  setProblem(null);
                  const result = await createBranch(org.id, name);
                  setBusy(false);
                  if (result.ok) {
                    setAdding(false);
                    setName("");
                    load();
                  } else {
                    setProblem(result.detail);
                  }
                }}
                disabled={busy || !name.trim()}
                className="flex-1 min-h-[48px] rounded-xl bg-brand text-white font-semibold disabled:bg-border disabled:text-muted flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Create · Tạo
              </button>
              <button
                onClick={() => setAdding(false)}
                className="min-h-[48px] px-4 rounded-xl border border-border"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          branches.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="w-full min-h-[56px] rounded-2xl border border-dashed border-border text-muted flex items-center justify-center gap-2"
            >
              <Plus size={16} /> New branch · Thêm chi nhánh
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function BranchesPage() {
  return <BranchesContent />;
}
