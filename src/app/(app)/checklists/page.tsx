"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BigCheckbox } from "@/components/ui/BigCheckbox";
import { useSession } from "@/lib/auth/RoleContext";
import { canCompleteChecklistArea, canEditChecklistTemplate } from "@/lib/auth/permissions";
import {
  getChecklistItems,
  getTicksForDate,
  toggleTick,
  addChecklistItem,
  getCompletion,
} from "@/lib/repo/checklists";
import { todayIso } from "@/lib/storage";
import type { ChecklistArea, ChecklistShift, ChecklistItem, ChecklistTick } from "@/lib/types";

function AddItemForm({
  area,
  shift,
  onAdded,
}: {
  area: ChecklistArea;
  shift: ChecklistShift;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [en, setEn] = useState("");
  const [vi, setVi] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2"
      >
        <Plus size={18} /> Add item · Thêm mục
      </button>
    );
  }

  return (
    <Card>
      <p className="font-semibold text-sm mb-2">New checklist item · Mục mới</p>
      <input
        value={en}
        onChange={(e) => setEn(e.target.value)}
        placeholder="English"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={vi}
        onChange={(e) => setVi(e.target.value)}
        placeholder="Tiếng Việt"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!en.trim() || !vi.trim()}
          onClick={() => {
            addChecklistItem(area, shift, en.trim(), vi.trim());
            setEn("");
            setVi("");
            setOpen(false);
            onAdded();
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  );
}

function ManagerOverview({ date }: { date: string }) {
  const areas: ChecklistArea[] = ["kitchen", "foh"];
  const shifts: ChecklistShift[] = ["opening", "closing"];
  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-3">Live completion · Tiến độ trực tiếp</p>
      <div className="grid grid-cols-2 gap-3">
        {areas.map((area) =>
          shifts.map((shift) => {
            const { done, total } = getCompletion(area, shift, date);
            const complete = total > 0 && done === total;
            return (
              <div key={`${area}-${shift}`} className="rounded-xl bg-background p-3">
                <p className="text-xs text-muted capitalize">
                  {area === "kitchen" ? "Kitchen" : "FOH"} · {shift === "opening" ? "Opening" : "Closing"}
                </p>
                <p className={`text-lg font-bold ${complete ? "text-success" : "text-foreground"}`}>
                  {done}/{total}
                </p>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function ChecklistsPageContent() {
  const { session } = useSession();
  const date = todayIso();
  const [area, setArea] = useState<ChecklistArea>("kitchen");
  const [shift, setShift] = useState<ChecklistShift>("opening");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [ticks, setTicks] = useState<ChecklistTick[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const availableAreas = useMemo<ChecklistArea[]>(() => {
    if (!session) return [];
    if (session.role === "owner" || session.role === "manager") return ["kitchen", "foh"];
    if (session.role === "chef") return ["kitchen"];
    return ["foh"];
  }, [session]);

  useEffect(() => {
    if (availableAreas.length && !availableAreas.includes(area)) setArea(availableAreas[0]);
  }, [availableAreas, area]);

  useEffect(() => {
    setItems(getChecklistItems(area, shift));
    setTicks(getTicksForDate(date));
  }, [area, shift, date, refreshKey]);

  if (!session) return null;

  const canComplete = canCompleteChecklistArea(session.role, area);
  const canEditTemplate = canEditChecklistTemplate(session.role);
  const isChecked = (itemId: string) => ticks.find((t) => t.itemId === itemId)?.checked ?? false;

  return (
    <div className="pb-6">
      <PageHeader
        title="Checklists · Danh Sách Công Việc"
        subtitle="Tap to check off · Chạm để hoàn thành"
      />

      <div className="px-4 md:px-8">
        {(session.role === "owner" || session.role === "manager") && <ManagerOverview date={date} />}

        {availableAreas.length > 1 && (
          <div className="flex gap-2 mb-3">
            {availableAreas.map((a) => (
              <button
                key={a}
                onClick={() => setArea(a)}
                className={`flex-1 min-h-12 rounded-xl font-semibold text-sm border-2 ${
                  area === a ? "bg-brand text-white border-brand" : "border-border text-foreground"
                }`}
              >
                {a === "kitchen" ? "Kitchen · Bếp" : "FOH · Phục vụ"}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {(["opening", "closing"] as ChecklistShift[]).map((s) => (
            <button
              key={s}
              onClick={() => setShift(s)}
              className={`flex-1 min-h-11 rounded-full font-semibold text-sm border-2 ${
                shift === s ? "bg-brand-light text-brand border-brand" : "border-border text-muted"
              }`}
            >
              {s === "opening" ? "Opening · Mở cửa" : "Closing · Đóng cửa"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              <BigCheckbox
                label={item.text}
                checked={isChecked(item.id)}
                disabled={!canComplete}
                onToggle={() => {
                  toggleTick(item.id, date, session.name);
                  setRefreshKey((k) => k + 1);
                }}
              />
              {item.linkHref && (
                <Link href={item.linkHref} className="flex items-center gap-1 text-xs text-brand font-semibold mt-1 ml-1">
                  Open log · Mở sổ ghi <ArrowRight size={12} />
                </Link>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-muted text-center py-6 text-sm">No items yet · Chưa có mục nào</p>
          )}
        </div>

        {canEditTemplate && (
          <div className="mt-4">
            <AddItemForm area={area} shift={shift} onAdded={() => setRefreshKey((k) => k + 1)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChecklistsPage() {
  return (
    <RoleGate module="checklists">
      <ChecklistsPageContent />
    </RoleGate>
  );
}
