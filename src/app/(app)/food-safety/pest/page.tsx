"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getPestSightings, logPestSighting, resolvePestSighting } from "@/lib/repo/foodSafety";
import { todayIso } from "@/lib/storage";
import type { PestSighting } from "@/lib/types";

function AddForm({ onAdded, staffName }: { onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [action, setAction] = useState("");
  const [reportedTo, setReportedTo] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a sighting · Ghi nhận côn trùng
      </button>
    );
  }

  const reset = () => {
    setLocation("");
    setAction("");
    setReportedTo("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New sighting · Ghi nhận mới</p>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location · Vị trí"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="Action taken · Hành động đã thực hiện"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={reportedTo}
        onChange={(e) => setReportedTo(e.target.value)}
        placeholder="Reported to · Báo cáo cho"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!location.trim() || !action.trim()}
          onClick={() => {
            logPestSighting(todayIso(), location.trim(), action.trim(), reportedTo.trim(), staffName);
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

function PestContent() {
  const { session } = useSession();
  const [sightings, setSightings] = useState<PestSighting[]>([]);
  const refresh = () => setSightings(getPestSightings());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "pest");

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader title="Pest Control · Kiểm Soát Côn Trùng" subtitle="Log sightings and actions · Ghi nhận và xử lý" />
      <div className="px-4 md:px-8">
        {canEnter && <AddForm onAdded={refresh} staffName={session.name} />}
        <div className="space-y-2">
          {sightings.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-sm">{p.location}</p>
                <Badge tone={p.status === "open" ? "warning" : "success"}>{p.status === "open" ? "Open" : "Resolved"}</Badge>
              </div>
              <p className="text-xs text-muted mb-1">
                {p.date} · {p.loggedBy}
              </p>
              <p className="text-sm">{p.action}</p>
              {p.reportedTo && <p className="text-xs text-muted mt-1">Reported to {p.reportedTo}</p>}
              {p.status === "open" && canEnter && (
                <Button variant="secondary" className="mt-2 min-h-10 text-sm" onClick={() => { resolvePestSighting(p.id); refresh(); }}>
                  Mark resolved · Đánh dấu đã xử lý
                </Button>
              )}
            </Card>
          ))}
          {sightings.length === 0 && <p className="text-muted text-center py-10 text-sm">No sightings logged · Chưa có ghi nhận nào</p>}
        </div>
      </div>
    </div>
  );
}

export default function PestPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="pest">
        <PestContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
