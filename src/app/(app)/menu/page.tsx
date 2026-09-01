"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle, CheckCircle2, Pencil, EyeOff, Printer } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { MenuPhotoButton } from "@/components/MenuPhotoButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditMenu, canSeeCostMargin } from "@/lib/auth/permissions";
import {
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  setMenuItemActive,
  updateMenuItemPrice,
  getReprintFlag,
  setReprintFlag,
  getPrintedMaterials,
  updatePrintedMaterial,
} from "@/lib/repo/menu";
import { getRecipe, getRecipes } from "@/lib/repo/recipes";
import { getSettings } from "@/lib/repo/settings";
import { MENU_CHANNEL_LABEL, MENU_CHANNEL_ORDER, MENU_CATEGORY_LABEL, PRINTED_MATERIAL_FIELD_LABEL } from "@/lib/menuLabels";
import { getAllPlatformStats } from "@/lib/repo/deliveryPerformance";
import type { MenuItem, MenuChannel, RecipeCategory, PrintedMaterial, Recipe } from "@/lib/types";

type Tab = "pricing" | "materials";

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}₫`;
}

function PriceCell({ item, channel, canEdit, onChanged }: { item: MenuItem; channel: MenuChannel; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.pricesVnd[channel] !== null ? String(item.pricesVnd[channel]) : "");
  const price = item.pricesVnd[channel];

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 min-h-10 rounded-lg border-2 border-border px-2 text-sm font-bold tabular-nums"
        />
        <button
          aria-label="Save price · Lưu giá"
          className="min-h-10 px-2 text-xs text-brand font-semibold"
          onClick={() => {
            updateMenuItemPrice(item.id, channel, value.trim() === "" ? null : Number(value));
            setEditing(false);
            onChanged();
          }}
        >
          ✓
        </button>
      </div>
    );
  }

  return (
    <button disabled={!canEdit} onClick={() => setEditing(true)} className="text-sm font-bold tabular-nums disabled:opacity-70">
      {price !== null ? vnd(price) : <span className="text-muted font-normal">Set price · Đặt giá</span>}
    </button>
  );
}

/** Shared by the add and edit forms — linking a recipe is what makes cost and margin work. */
function RecipeSelect({ recipes, value, onChange }: { recipes: Recipe[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm bg-surface focus:outline-none focus:border-brand"
    >
      <option value="">No recipe linked · Chưa gắn công thức</option>
      {recipes.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name.en} · {r.name.vi}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({ value, onChange }: { value: RecipeCategory; onChange: (v: RecipeCategory) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as RecipeCategory)}
      className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm bg-surface focus:outline-none focus:border-brand"
    >
      {(Object.keys(MENU_CATEGORY_LABEL) as RecipeCategory[]).map((c) => (
        <option key={c} value={c}>
          {MENU_CATEGORY_LABEL[c].en} · {MENU_CATEGORY_LABEL[c].vi}
        </option>
      ))}
    </select>
  );
}

function EditMenuItemForm({ item, recipes, onDone }: { item: MenuItem; recipes: Recipe[]; onDone: () => void }) {
  const [en, setEn] = useState(item.name.en);
  const [vi, setVi] = useState(item.name.vi);
  const [category, setCategory] = useState<RecipeCategory>(item.category);
  const [recipeId, setRecipeId] = useState(item.recipeId ?? "");

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <input
        value={en}
        onChange={(e) => setEn(e.target.value)}
        placeholder="Name (English) · Tên (Tiếng Anh)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={vi}
        onChange={(e) => setVi(e.target.value)}
        placeholder="Name (Vietnamese) · Tên (Tiếng Việt)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
      />
      <CategorySelect value={category} onChange={setCategory} />
      <RecipeSelect recipes={recipes} value={recipeId} onChange={setRecipeId} />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={onDone}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-11 text-sm"
          disabled={!en.trim() || !vi.trim()}
          onClick={() => {
            updateMenuItem(item.id, {
              name: { en: en.trim(), vi: vi.trim() },
              category,
              recipeId: recipeId || undefined,
            });
            onDone();
          }}
        >
          Save · Lưu
        </Button>
      </div>
      <button
        onClick={() => {
          if (!window.confirm(`Remove ${item.name.en} from the menu? · Bỏ ${item.name.vi} khỏi thực đơn?`)) return;
          setMenuItemActive(item.id, false);
          onDone();
        }}
        className="w-full min-h-11 text-xs text-danger font-semibold flex items-center justify-center gap-1"
      >
        <EyeOff size={12} /> Remove from menu · Bỏ khỏi thực đơn
      </button>
    </div>
  );
}

function MenuItemCard({
  item,
  recipes,
  canEdit,
  showMargin,
  onChanged,
}: {
  item: MenuItem;
  recipes: Recipe[];
  canEdit: boolean;
  showMargin: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const recipe = item.recipeId ? getRecipe(item.recipeId) : undefined;
  const cost = recipe?.costPerPortionVnd;
  const dineInPrice = item.pricesVnd.dine_in;
  const margin = showMargin && cost !== undefined && dineInPrice !== null ? dineInPrice - cost : null;

  // What the delivery price is actually worth. A 25% commission turns a
  // healthy-looking listed price into a loss more often than anyone expects,
  // and the platform's cut lives three screens away — so it is said here,
  // next to the price, at the worst commission currently on file.
  const deliveryPrice = item.pricesVnd.delivery;
  const worstCommission = showMargin
    ? getAllPlatformStats().reduce<number | null>(
        (worst, s) =>
          s.commissionPct !== null && (worst === null || s.commissionPct > worst)
            ? s.commissionPct
            : worst,
        null
      )
    : null;
  const deliveryKeep =
    showMargin && deliveryPrice !== null && worstCommission !== null
      ? Math.round(deliveryPrice * (1 - worstCommission / 100))
      : null;
  const deliveryMargin = deliveryKeep !== null && cost !== undefined ? deliveryKeep - cost : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* The photo the waiter's pad and the guest's phone will show. Owner
            and manager set it here, where the rest of the item lives. */}
        {canEdit && <MenuPhotoButton item={item} onChange={onChanged} />}
        <Bi value={item.name} className="font-semibold text-sm flex-1 min-w-0" />
        {canEdit && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="min-h-11 px-2 flex items-center gap-1 text-xs text-brand font-semibold shrink-0"
          >
            <Pencil size={12} /> Edit · Sửa
          </button>
        )}
      </div>
      {item.priceNote && (
        <div className="mb-2 rounded-lg bg-warning-tint px-2 py-1.5 flex items-start gap-1.5">
          <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-warning">
            <Bi value={item.priceNote} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {MENU_CHANNEL_ORDER.map((c) => (
          <div key={c} className="text-center">
            <Bi value={MENU_CHANNEL_LABEL[c]} className="text-[11px] text-muted mb-1 block" mode="inline" />
            <PriceCell item={item} channel={c} canEdit={canEdit} onChanged={onChanged} />
          </div>
        ))}
      </div>
      {showMargin && cost !== undefined && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted">Cost · Giá vốn {vnd(cost)}</span>
          {margin !== null && (
            <span className={margin >= 0 ? "text-success font-semibold" : "text-danger font-semibold"}>
              Margin · Lợi nhuận {vnd(margin)}
            </span>
          )}
        </div>
      )}
      {deliveryKeep !== null && (
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted">
            Delivery after {worstCommission}% · Sau chiết khấu {vnd(deliveryKeep)}
          </span>
          {deliveryMargin !== null && (
            <span className={deliveryMargin >= 0 ? "text-success font-semibold" : "text-danger font-semibold"}>
              {vnd(deliveryMargin)}
            </span>
          )}
        </div>
      )}
      {showMargin && cost === undefined && canEdit && (
        <p className="mt-2 pt-2 border-t border-border text-xs text-muted">No recipe linked — no cost shown · Chưa gắn công thức — chưa có giá vốn</p>
      )}
      {editing && (
        <EditMenuItemForm
          item={item}
          recipes={recipes}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function AddMenuItemForm({ recipes, onAdded }: { recipes: Recipe[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [en, setEn] = useState("");
  const [vi, setVi] = useState("");
  const [category, setCategory] = useState<RecipeCategory>("main");
  const [recipeId, setRecipeId] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add menu item · Thêm món
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New menu item · Món mới</p>
      <input
        value={en}
        onChange={(e) => setEn(e.target.value)}
        placeholder="Name (English) · Tên (Tiếng Anh)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={vi}
        onChange={(e) => setVi(e.target.value)}
        placeholder="Name (Vietnamese) · Tên (Tiếng Việt)"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <div className="mb-2">
        <CategorySelect value={category} onChange={setCategory} />
      </div>
      <div className="mb-3">
        <RecipeSelect recipes={recipes} value={recipeId} onChange={setRecipeId} />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!en.trim() || !vi.trim()}
          onClick={() => {
            addMenuItem({ en: en.trim(), vi: vi.trim() }, category, recipeId || undefined);
            setEn("");
            setVi("");
            setRecipeId("");
            setOpen(false);
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function PricingTab({ canEdit, showMargin }: { canEdit: boolean; showMargin: boolean }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [reprint, setReprint] = useState(false);
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const refresh = () => {
    // Inactive items are loaded too so a discontinued item can be put back on
    // the menu — hiding one is never a dead end.
    setItems(getMenuItems(false));
    setRecipes(getRecipes());
    setReprint(getReprintFlag());
  };

  useEffect(() => refresh(), []);

  const discontinued = items.filter((i) => !i.active);
  const grouped = (Object.keys(MENU_CATEGORY_LABEL) as RecipeCategory[])
    .map((cat) => [cat, items.filter((i) => i.active && i.category === cat)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <div>
      {reprint && (
        <Card className="mb-4 border-warning/40 bg-warning-tint flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning shrink-0" />
            <p className="text-sm font-semibold text-warning">Menu reprint needed · Cần in lại menu</p>
          </div>
          {canEdit && (
            <button
              className="min-h-11 px-2 text-xs font-semibold text-warning underline shrink-0"
              onClick={() => {
                setReprintFlag(false);
                refresh();
              }}
            >
              Mark reprinted · Đã in lại
            </button>
          )}
        </Card>
      )}
      {canEdit && <AddMenuItemForm recipes={recipes} onAdded={refresh} />}
      <div className="space-y-5">
        {grouped.map(([cat, list]) => (
          <div key={cat}>
            <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
              <Bi value={MENU_CATEGORY_LABEL[cat]} mode="inline" />
            </h2>
            <div className="space-y-2">
              {list.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  recipes={recipes}
                  canEdit={canEdit}
                  showMargin={showMargin}
                  onChanged={refresh}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {canEdit && discontinued.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowDiscontinued((v) => !v)}
            className="w-full min-h-11 text-xs text-brand font-semibold"
          >
            {showDiscontinued
              ? "Hide discontinued · Ẩn món đã bỏ"
              : `Show discontinued (${discontinued.length}) · Xem món đã bỏ (${discontinued.length})`}
          </button>
          {showDiscontinued && (
            <div className="space-y-2 mt-2">
              {discontinued.map((item) => (
                <Card key={item.id} className="flex items-center justify-between gap-2">
                  <Bi value={item.name} className="text-sm text-muted min-w-0" mode="inline" />
                  <button
                    onClick={() => {
                      setMenuItemActive(item.id, true);
                      refresh();
                    }}
                    className="min-h-11 px-2 text-xs text-brand font-semibold shrink-0"
                  >
                    Put back · Đưa lại vào menu
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MaterialDetailsForm({ material, onDone }: { material: PrintedMaterial; onDone: () => void }) {
  const [par, setPar] = useState(String(material.par));
  const [reorderPoint, setReorderPoint] = useState(String(material.reorderPoint));
  const [source, setSource] = useState(material.source ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(material.leadTimeDays !== undefined ? String(material.leadTimeDays) : "");

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <label className="block">
        <Bi value={PRINTED_MATERIAL_FIELD_LABEL.par} className="text-xs text-muted mb-1 block" mode="inline" />
        <input
          type="number"
          inputMode="numeric"
          value={par}
          onChange={(e) => setPar(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm tabular-nums focus:outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <Bi value={PRINTED_MATERIAL_FIELD_LABEL.reorderPoint} className="text-xs text-muted mb-1 block" mode="inline" />
        <input
          type="number"
          inputMode="numeric"
          value={reorderPoint}
          onChange={(e) => setReorderPoint(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm tabular-nums focus:outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <Bi value={PRINTED_MATERIAL_FIELD_LABEL.source} className="text-xs text-muted mb-1 block" mode="inline" />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. · ví dụ: In Nhanh Thảo Điền"
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <Bi value={PRINTED_MATERIAL_FIELD_LABEL.leadTime} className="text-xs text-muted mb-1 block" mode="inline" />
        <input
          type="number"
          inputMode="numeric"
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(e.target.value)}
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm tabular-nums focus:outline-none focus:border-brand"
        />
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1 min-h-11 text-sm" onClick={onDone}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-11 text-sm"
          onClick={() => {
            updatePrintedMaterial(material.id, {
              par: Number(par) || 0,
              reorderPoint: Number(reorderPoint) || 0,
              source: source.trim() || undefined,
              leadTimeDays: leadTimeDays.trim() === "" ? undefined : Number(leadTimeDays) || 0,
            });
            onDone();
          }}
        >
          Save · Lưu
        </Button>
      </div>
    </div>
  );
}

function MaterialCard({ material: m, canEdit, onChanged }: { material: PrintedMaterial; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const low = m.onHand <= m.reorderPoint;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Bi value={m.name} className="font-semibold text-sm" mode="inline" />
        {low ? (
          <Badge tone="warning">
            <AlertTriangle size={12} /> Reorder · Đặt thêm
          </Badge>
        ) : (
          <Badge tone="success">
            <CheckCircle2 size={12} /> OK · Đủ
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <Bi value={PRINTED_MATERIAL_FIELD_LABEL.onHand} className="text-[11px] text-muted mb-1 block" mode="inline" />
          <input
            type="number"
            inputMode="numeric"
            disabled={!canEdit}
            value={m.onHand}
            aria-label={`${PRINTED_MATERIAL_FIELD_LABEL.onHand.en} · ${m.name.en}`}
            onChange={(e) => {
              updatePrintedMaterial(m.id, { onHand: Number(e.target.value) || 0 });
              onChanged();
            }}
            className="w-full min-h-11 text-center border-2 border-border rounded-lg text-sm font-bold tabular-nums disabled:opacity-60 focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <Bi value={PRINTED_MATERIAL_FIELD_LABEL.par} className="text-[11px] text-muted mb-1 block" mode="inline" />
          <p className="min-h-11 flex items-center justify-center text-sm font-bold tabular-nums text-muted">{m.par}</p>
        </div>
        <div>
          <Bi value={PRINTED_MATERIAL_FIELD_LABEL.reorderPoint} className="text-[11px] text-muted mb-1 block" mode="inline" />
          <p className="min-h-11 flex items-center justify-center text-sm font-bold tabular-nums text-muted">{m.reorderPoint}</p>
        </div>
      </div>

      <button
        disabled={!canEdit}
        onClick={() => {
          updatePrintedMaterial(m.id, { toReprint: !m.toReprint });
          onChanged();
        }}
        className={`w-full min-h-11 mt-2 rounded-xl border-2 text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-60 ${
          m.toReprint ? "bg-warning-tint border-warning/40 text-warning" : "border-border text-muted"
        }`}
      >
        <Printer size={13} />
        {m.toReprint ? "To reprint · Cần in lại" : "Not due for reprint · Chưa cần in lại"}
      </button>

      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2 text-xs">
        <span className="text-muted min-w-0">
          {m.source || "No printer set · Chưa có nhà in"}
          {m.leadTimeDays !== undefined && ` · ${m.leadTimeDays} day lead · ${m.leadTimeDays} ngày chờ`}
        </span>
        {canEdit && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="min-h-11 px-2 flex items-center gap-1 text-brand font-semibold shrink-0"
          >
            <Pencil size={11} /> Edit · Sửa
          </button>
        )}
      </div>

      {editing && (
        <MaterialDetailsForm
          material={m}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function MaterialsTab({ canEdit }: { canEdit: boolean }) {
  const [materials, setMaterials] = useState<PrintedMaterial[]>([]);
  const refresh = () => setMaterials(getPrintedMaterials());
  useEffect(() => refresh(), []);

  return (
    <div className="space-y-2">
      {materials.map((m) => (
        <MaterialCard key={m.id} material={m} canEdit={canEdit} onChanged={refresh} />
      ))}
      {materials.length === 0 && <p className="text-muted text-center py-10 text-sm">No printed materials yet · Chưa có ấn phẩm nào</p>}
    </div>
  );
}

function MenuContent() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("pricing");

  if (!session) return null;
  const canEdit = canEditMenu(session.role);
  const showMargin = canSeeCostMargin(session.role, getSettings());

  return (
    <div className="pb-6">
      <PageHeader title="Menu & Pricing · Thực Đơn & Giá" subtitle="Single source of truth · Nguồn dữ liệu duy nhất" />
      <div className="px-4 md:px-8">
        <div className="flex gap-2 mb-4">
          {([
            ["pricing", "Pricing · Giá"],
            ["materials", "Printed Materials · Ấn phẩm"],
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
        {tab === "pricing" && <PricingTab canEdit={canEdit} showMargin={showMargin} />}
        {tab === "materials" && <MaterialsTab canEdit={canEdit} />}
      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <RoleGate module="menu">
      <MenuContent />
    </RoleGate>
  );
}
