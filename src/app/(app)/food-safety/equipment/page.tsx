"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, Loader2, Plus, Search, Snowflake, Refrigerator } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditSuppliers } from "@/lib/auth/permissions";
import { onSyncedDataChanged } from "@/lib/sync/engine";
import { getFridgeUnits, addFridgeUnit, deactivateFridgeUnit } from "@/lib/repo/foodSafety";
import { getEquipmentCatalog, refreshEquipmentCatalog, submitEquipmentSuggestion } from "@/lib/repo/equipmentCatalog";
import { defaultTargetRangeC, validateCustomEquipment, equipmentSummary } from "@/lib/repo/equipmentRules";
import type { FridgeUnit, EquipmentCatalogEntry, EquipmentCategory } from "@/lib/types";

/**
 * Every fridge and freezer a restaurant actually owns.
 *
 * Reference data used to mean "the same seed for everyone" — fine for
 * recipes, wrong for equipment. A restaurant's fleet grows over its life
 * (a second freezer bought next summer) and has to be visible on every
 * device the day it's added, so units sync (lib/sync/collections.ts) the
 * same way the menu does.
 *
 * Picking a real model from the shared catalog fills in sensible defaults;
 * typing one in by hand still works, and quietly tells the platform so a
 * genuinely common model can be added for every future customer.
 */

const CATEGORY_LABEL: Record<EquipmentCategory, { en: string; vi: string }> = {
  fridge: { en: "Fridge", vi: "Tủ mát" },
  freezer: { en: "Freezer", vi: "Tủ đông" },
  combo: { en: "Fridge/freezer combo", vi: "Tủ kết hợp" },
};

function AddUnitFlow({ onDone, staffName }: { onDone: () => void; staffName: string }) {
  const [step, setStep] = useState<"category" | "pick" | "custom">("category");
  const [category, setCategory] = useState<EquipmentCategory>("fridge");
  const [catalog, setCatalog] = useState<EquipmentCatalogEntry[]>(getEquipmentCatalog());
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [custom, setCustom] = useState({ brand: "", model: "", capacityLiters: "" });
  const [range, setRange] = useState(defaultTargetRangeC("fridge"));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshEquipmentCatalog().then(() => setCatalog(getEquipmentCatalog()));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((c) => c.category === category)
      .filter((c) => !q || `${c.brand} ${c.model}`.toLowerCase().includes(q));
  }, [catalog, category, query]);

  const saveFromCatalog = (entry: EquipmentCatalogEntry) => {
    const label = name.trim() || `${entry.brand} ${entry.model}`;
    addFridgeUnit({
      name: { en: label, vi: label },
      kind: entry.category,
      targetMinC: entry.targetMinC,
      targetMaxC: entry.targetMaxC,
      catalogId: entry.id,
      brand: entry.brand,
      model: entry.model,
      capacityLiters: entry.capacityLiters ?? undefined,
    });
    onDone();
  };

  const saveCustom = async () => {
    const capacityLiters = custom.capacityLiters.trim() ? Number(custom.capacityLiters) : undefined;
    const verdict = validateCustomEquipment({
      brand: custom.brand,
      model: custom.model,
      capacityLiters,
      minC: range.minC,
      maxC: range.maxC,
    });
    if (!verdict.ok) {
      setProblem(
        verdict.reason === "brand"
          ? "Enter the brand · Nhập hãng"
          : verdict.reason === "model"
            ? "Enter the model · Nhập model"
            : verdict.reason === "capacity"
              ? "Capacity should be a positive number · Dung tích phải là số dương"
              : "The low end must be below the high end · Nhiệt độ thấp phải nhỏ hơn cao"
      );
      return;
    }
    setBusy(true);
    const label = name.trim() || `${custom.brand.trim()} ${custom.model.trim()}`;
    addFridgeUnit({
      name: { en: label, vi: label },
      kind: category,
      targetMinC: range.minC,
      targetMaxC: range.maxC,
      brand: custom.brand.trim(),
      model: custom.model.trim(),
      capacityLiters,
    });
    // Fire-and-forget: the unit is saved either way. This just tells VINPOS
    // a real model exists that isn't in the shared catalog yet.
    void submitEquipmentSuggestion({
      category,
      brand: custom.brand,
      model: custom.model,
      capacityLiters,
      submittedBy: staffName || undefined,
    });
    setBusy(false);
    onDone();
  };

  if (step === "category") {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-sm">Add a fridge or freezer · Thêm tủ mát hoặc tủ đông</p>
        <div className="grid grid-cols-2 gap-2">
          {(["fridge", "freezer"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setCategory(k);
                setRange(defaultTargetRangeC(k));
                setStep("pick");
              }}
              className="min-h-[64px] rounded-xl border-2 border-border flex flex-col items-center justify-center gap-1 active:border-brand"
            >
              {k === "fridge" ? <Refrigerator size={20} /> : <Snowflake size={20} />}
              <span className="text-xs font-semibold">
                {CATEGORY_LABEL[k].en} · {CATEGORY_LABEL[k].vi}
              </span>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  if (step === "pick") {
    return (
      <Card className="space-y-3">
        <button onClick={() => setStep("category")} className="flex items-center gap-1 text-xs text-muted">
          <ChevronLeft size={14} /> Back · Quay lại
        </button>
        <p className="font-semibold text-sm">
          Pick the model · Chọn model ({CATEGORY_LABEL[category].en})
        </p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand or model · Tìm hãng hoặc model"
            className="w-full min-h-[48px] rounded-xl border border-border pl-9 pr-3"
          />
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-border rounded-xl border border-border">
          {results.map((entry) => (
            <button
              key={entry.id}
              onClick={() => saveFromCatalog(entry)}
              className="w-full text-left px-3 py-2.5 min-h-[52px] active:bg-brand-light"
            >
              <span className="block text-sm font-semibold">{entry.brand} {entry.model}</span>
              <span className="block text-xs text-muted">
                {entry.capacityLiters ? `${entry.capacityLiters}L · ` : ""}
                {entry.targetMinC}°C to {entry.targetMaxC}°C
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted text-center">
              No match · Không tìm thấy
            </p>
          )}
        </div>
        <button
          onClick={() => setStep("custom")}
          className="w-full min-h-[48px] rounded-xl border border-dashed border-brand text-brand text-sm font-semibold"
        >
          Can&apos;t find it? Add your own · Không thấy? Tự nhập
        </button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <button onClick={() => setStep("pick")} className="flex items-center gap-1 text-xs text-muted">
        <ChevronLeft size={14} /> Back · Quay lại
      </button>
      <p className="font-semibold text-sm">Add your own · Tự nhập model</p>
      <p className="text-xs text-muted">
        We&apos;ll let the VINPOS team know, in case it&apos;s worth adding for everyone.
        <br />
        Chúng tôi sẽ báo đội VINPOS — có thể sẽ thêm vào cho mọi khách hàng.
      </p>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Label for this unit (optional) · Tên gọi (tuỳ chọn)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kitchen Fridge 2"
          className="w-full min-h-[48px] rounded-xl border border-border px-3"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Brand · Hãng</span>
          <input
            value={custom.brand}
            onChange={(e) => setCustom({ ...custom, brand: e.target.value })}
            className="w-full min-h-[48px] rounded-xl border border-border px-3"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Model</span>
          <input
            value={custom.model}
            onChange={(e) => setCustom({ ...custom, model: e.target.value })}
            className="w-full min-h-[48px] rounded-xl border border-border px-3"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Capacity in litres, optional · Dung tích (lít), tuỳ chọn</span>
        <input
          value={custom.capacityLiters}
          onChange={(e) => setCustom({ ...custom, capacityLiters: e.target.value })}
          inputMode="numeric"
          className="w-full min-h-[48px] rounded-xl border border-border px-3 tabular-nums"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Low °C · Thấp</span>
          <input
            value={range.minC}
            onChange={(e) => setRange({ ...range, minC: Number(e.target.value) })}
            inputMode="numeric"
            className="w-full min-h-[48px] rounded-xl border border-border px-3 tabular-nums"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">High °C · Cao</span>
          <input
            value={range.maxC}
            onChange={(e) => setRange({ ...range, maxC: Number(e.target.value) })}
            inputMode="numeric"
            className="w-full min-h-[48px] rounded-xl border border-border px-3 tabular-nums"
          />
        </label>
      </div>
      {problem && (
        <p className="text-xs text-warning flex items-center gap-1.5">
          <AlertTriangle size={13} /> {problem}
        </p>
      )}
      <button
        onClick={saveCustom}
        disabled={busy}
        className="w-full min-h-[52px] rounded-xl bg-brand text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        Add unit · Thêm tủ
      </button>
    </Card>
  );
}

function EquipmentContent() {
  const { session } = useSession();
  const [units, setUnits] = useState<FridgeUnit[]>([]);
  const [adding, setAdding] = useState(false);

  const load = () => setUnits(getFridgeUnits());
  useEffect(() => {
    load();
    return onSyncedDataChanged(load);
  }, []);

  if (!session) return null;
  const canEdit = canEditSuppliers(session.role);
  if (!canEdit) {
    return (
      <div className="p-6 text-center text-muted text-sm mt-16">
        Not available for your role · Không khả dụng cho vai trò của bạn
      </div>
    );
  }

  return (
    <div className="pb-6">
      <BackLink href="/food-safety/temperature" label="Fridge & Freezer Temp · Nhiệt Độ" />
      <PageHeader
        title="Fridges & Freezers · Tủ Mát & Tủ Đông"
        subtitle="Add every unit you actually have · Thêm tất cả các tủ bạn có"
      />
      <div className="px-4 md:px-8 space-y-3">
        {units.map((unit) => {
          const summary = equipmentSummary(unit.brand, unit.model, unit.capacityLiters);
          return (
            <Card key={unit.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{unit.name.en}</p>
                <p className="text-xs text-muted">{unit.name.vi}</p>
                {summary && <p className="text-xs text-muted mt-0.5">{summary}</p>}
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  {unit.targetMinC}°C – {unit.targetMaxC}°C
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Remove ${unit.name.en}? Its past readings stay on record.`)) {
                    deactivateFridgeUnit(unit.id);
                    load();
                  }
                }}
                className="text-xs text-danger font-semibold shrink-0 min-h-[36px] px-2"
              >
                Remove · Gỡ
              </button>
            </Card>
          );
        })}

        {adding ? (
          <AddUnitFlow
            staffName={session.name}
            onDone={() => {
              setAdding(false);
              load();
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full min-h-[56px] rounded-2xl border-2 border-dashed border-brand text-brand font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add fridge or freezer · Thêm tủ mát/tủ đông
          </button>
        )}
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <RoleGate module="foodSafety">
      <EquipmentContent />
    </RoleGate>
  );
}
