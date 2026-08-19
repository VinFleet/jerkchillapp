"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getCookLogs, logCookTemp } from "@/lib/repo/foodSafety";
import type { CookTempLog } from "@/lib/types";

function AddForm({ onAdded, staffName }: { onAdded: () => void; staffName: string }) {
  const [open, setOpen] = useState(false);
  const [dish, setDish] = useState("");
  const [batch, setBatch] = useState("");
  const [temp, setTemp] = useState("");
  const [action, setAction] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a batch · Ghi mẻ nấu
      </button>
    );
  }

  const reset = () => {
    setDish("");
    setBatch("");
    setTemp("");
    setAction("");
    setOpen(false);
  };

  const underTarget = temp.trim() !== "" && Number(temp) < 75;

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New cook temp log · Ghi nhiệt độ nấu mới</p>
      <input
        value={dish}
        onChange={(e) => setDish(e.target.value)}
        placeholder="Dish · Món ăn (e.g. Jerk Chicken)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={batch}
        onChange={(e) => setBatch(e.target.value)}
        placeholder="Batch label · Mẻ (e.g. Lunch batch 1)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          placeholder="Probe temp"
          className="w-32 min-h-12 rounded-xl border-2 border-border px-3 text-sm font-bold focus:outline-none focus:border-brand"
        />
        <span className="text-muted text-sm">°C · target ≥75°C / 30s</span>
      </div>
      {underTarget && (
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action taken (required — under target) · Hành động khắc phục"
          className="w-full min-h-12 rounded-xl border-2 border-danger/40 px-3 mb-3 text-sm focus:outline-none focus:border-danger"
        />
      )}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!dish.trim() || !batch.trim() || temp.trim() === "" || (underTarget && !action.trim())}
          onClick={() => {
            logCookTemp(dish.trim(), batch.trim(), Number(temp), staffName, underTarget ? action.trim() : undefined);
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

function CookingContent() {
  const { session } = useSession();
  const [logs, setLogs] = useState<CookTempLog[]>([]);
  const refresh = () => setLogs(getCookLogs());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "cooking");

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Cooking / Core Temp · Nhiệt Độ Nấu / Lõi"
        subtitle="Probe every batch · Đo mỗi mẻ nấu"
      />
      <div className="px-4 md:px-8">
        {canEnter && <AddForm onAdded={refresh} staffName={session.name} />}
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{log.dish}</p>
                  <p className="text-xs text-muted">
                    {log.batchLabel} · {log.loggedBy} · {new Date(log.loggedAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">{log.probeTempC}°C</p>
                  {log.targetMet ? (
                    <Badge tone="success">
                      <CheckCircle2 size={12} /> Target met
                    </Badge>
                  ) : (
                    <Badge tone="danger">
                      <AlertTriangle size={12} /> Under target
                    </Badge>
                  )}
                </div>
              </div>
              {log.correctiveAction && <p className="text-xs text-danger mt-2">Action: {log.correctiveAction}</p>}
            </Card>
          ))}
          {logs.length === 0 && <p className="text-muted text-center py-10 text-sm">No entries yet · Chưa có mục nào</p>}
        </div>
      </div>
    </div>
  );
}

export default function CookingPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="cooking">
        <CookingContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
