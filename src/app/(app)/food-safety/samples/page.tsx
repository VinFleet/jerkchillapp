"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BigCheckbox } from "@/components/ui/BigCheckbox";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getSamples, logSample, markSampleDiscarded, getDestructionChecks, logDestructionCheck, getOverdueSamples } from "@/lib/repo/foodSafety";
import { todayIso, addDaysIso } from "@/lib/storage";
import type { FoodSample, SampleDestructionCheck } from "@/lib/types";

type Tab = "samples" | "weekly";

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(dateIso, diff);
}

function AddForm({ onAdded, staffName }: { onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [dish, setDish] = useState("");
  const [qty, setQty] = useState("");
  const [location, setLocation] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a sample · Ghi mẫu lưu
      </button>
    );
  }

  const reset = () => {
    setDish("");
    setQty("");
    setLocation("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New sample · Mẫu lưu mới</p>
      <p className="text-xs text-muted mb-2">≥100g solid / ready-to-eat dishes, ≥150ml soups · liquid dishes</p>
      <input
        value={dish}
        onChange={(e) => setDish(e.target.value)}
        placeholder="Dish served · Món đã phục vụ"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Quantity · Số lượng (e.g. 100g)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Storage location · Vị trí lưu"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!dish.trim() || !qty.trim() || !location.trim()}
          onClick={() => {
            logSample(dish.trim(), qty.trim(), location.trim(), staffName);
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

function SamplesTab({ staffName }: { staffName: string }) {
  const [samples, setSamples] = useState<FoodSample[]>([]);
  const refresh = () => setSamples(getSamples());

  useEffect(() => refresh(), []);

  const { session } = useSession();
  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "samples");
  const now = new Date().toISOString();

  return (
    <div>
      {canEnter && <AddForm onAdded={refresh} staffName={staffName} />}
      <div className="space-y-2">
        {samples.map((s) => {
          const overdue = !s.discarded && s.discardBy < now;
          return (
            <Card key={s.id} className={overdue ? "border-warning/40" : undefined}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-sm">{s.dish}</p>
                {s.discarded ? (
                  <Badge tone="success">
                    <CheckCircle2 size={12} /> Discarded
                  </Badge>
                ) : overdue ? (
                  <Badge tone="warning">
                    <AlertTriangle size={12} /> Discard now
                  </Badge>
                ) : (
                  <Badge tone="muted">Holding</Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                {s.qty} · {s.storageLocation} · served {new Date(s.servedAt).toLocaleString()}
              </p>
              <p className="text-xs text-muted">Discard by {new Date(s.discardBy).toLocaleString()}</p>
              {!s.discarded && canEnter && (
                <Button variant="secondary" className="mt-2 min-h-10 text-sm" onClick={() => { markSampleDiscarded(s.id); refresh(); }}>
                  Mark discarded · Đánh dấu đã hủy
                </Button>
              )}
            </Card>
          );
        })}
        {samples.length === 0 && <p className="text-muted text-center py-10 text-sm">No samples logged yet · Chưa có mẫu nào</p>}
      </div>
    </div>
  );
}

function WeeklyCheckForm({ overdueCount, staffName, onLogged }: { overdueCount: number; staffName: string; onLogged: () => void }) {
  const [allDiscarded, setAllDiscarded] = useState(false);
  const [storageCleaned, setStorageCleaned] = useState(false);
  const [issues, setIssues] = useState("");

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-1">Weekly Sample Destruction Check · Kiểm Tra Hủy Mẫu Hàng Tuần</p>
      <p className="text-xs text-muted mb-3">Week of {mondayOf(todayIso())}</p>
      {overdueCount > 0 && (
        <p className="text-xs text-warning font-semibold mb-2">{overdueCount} sample(s) still not discarded — check the Samples tab first.</p>
      )}
      <div className="space-y-2 mb-2">
        <BigCheckbox label={{ en: "All samples ≥24h discarded", vi: "Tất cả mẫu ≥24h đã hủy" }} checked={allDiscarded} onToggle={() => setAllDiscarded((v) => !v)} />
        <BigCheckbox label={{ en: "Storage box / shelf cleaned", vi: "Hộp / kệ lưu mẫu đã vệ sinh" }} checked={storageCleaned} onToggle={() => setStorageCleaned((v) => !v)} />
      </div>
      <input
        value={issues}
        onChange={(e) => setIssues(e.target.value)}
        placeholder="Issues found (optional) · Vấn đề phát hiện"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-3 text-sm"
      />
      <Button
        className="w-full min-h-11 text-sm"
        onClick={() => {
          logDestructionCheck(mondayOf(todayIso()), allDiscarded, storageCleaned, staffName, issues.trim() || undefined);
          setAllDiscarded(false);
          setStorageCleaned(false);
          setIssues("");
          onLogged();
        }}
      >
        Log check · Ghi nhận
      </Button>
    </Card>
  );
}

function WeeklyTab({ staffName, canEnter }: { staffName: string; canEnter: boolean }) {
  const [checks, setChecks] = useState<SampleDestructionCheck[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const refresh = () => {
    setChecks(getDestructionChecks());
    setOverdueCount(getOverdueSamples().length);
  };

  useEffect(() => refresh(), []);

  return (
    <div>
      {canEnter && <WeeklyCheckForm overdueCount={overdueCount} staffName={staffName} onLogged={refresh} />}
      <div className="space-y-2">
        {checks.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm">Week of {c.weekOf}</p>
              <Badge tone={c.allDiscarded && c.storageCleaned ? "success" : "warning"}>
                {c.allDiscarded && c.storageCleaned ? "All clear" : "Needs attention"}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              Discarded: {c.allDiscarded ? "Yes" : "No"} · Storage cleaned: {c.storageCleaned ? "Yes" : "No"}
            </p>
            {c.issuesFound && <p className="text-xs text-danger mt-1">{c.issuesFound}</p>}
            <p className="text-xs text-muted mt-1">{c.checkedBy}</p>
          </Card>
        ))}
        {checks.length === 0 && <p className="text-muted text-center py-10 text-sm">No weekly checks logged yet · Chưa có kiểm tra hàng tuần</p>}
      </div>
    </div>
  );
}

function SamplesContent() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("samples");

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "samples");

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Food Sample Retention · Lưu Mẫu Thức Ăn"
        subtitle="Discard after the 24h minimum · Hủy sau tối thiểu 24 giờ"
      />
      <div className="px-4 md:px-8">
        <div className="flex gap-2 mb-4">
          {([
            ["samples", "Samples · Mẫu lưu"],
            ["weekly", "Weekly Check · Kiểm tra tuần"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 min-h-11 rounded-full font-semibold text-sm border-2 ${
                tab === t ? "bg-brand text-white border-brand" : "border-border text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "samples" && <SamplesTab staffName={session.name} />}
        {tab === "weekly" && <WeeklyTab staffName={session.name} canEnter={canEnter} />}
      </div>
    </div>
  );
}

export default function SamplesPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="samples">
        <SamplesContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
