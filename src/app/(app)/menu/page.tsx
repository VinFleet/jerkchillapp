"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditMenu, canSeeCostMargin } from "@/lib/auth/permissions";
import { getMenuItems, addMenuItem, updateMenuItemPrice, getReprintFlag, setReprintFlag, getPrintedMaterials, updatePrintedMaterial } from "@/lib/repo/menu";
import { getRecipe } from "@/lib/repo/recipes";
import { getSettings } from "@/lib/repo/settings";
import { MENU_CHANNEL_LABEL, MENU_CHANNEL_ORDER, MENU_CATEGORY_LABEL } from "@/lib/menuLabels";
import type { MenuItem, MenuChannel, RecipeCategory, PrintedMaterial } from "@/lib/types";

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
          className="text-xs text-brand font-semibold"
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
      {price !== null ? vnd(price) : <span className="text-muted font-normal">Set price</span>}
    </button>
  );
}

function MenuItemCard({ item, canEdit, showMargin, onChanged }: { item: MenuItem; canEdit: boolean; showMargin: boolean; onChanged: () => void }) {
  const recipe = item.recipeId ? getRecipe(item.recipeId) : undefined;
  const cost = recipe?.costPerPortionVnd;
  const dineInPrice = item.pricesVnd.dine_in;
  const margin = showMargin && cost !== undefined && dineInPrice !== null ? dineInPrice - cost : null;

  return (
    <Card>
      <Bi value={item.name} className="font-semibold text-sm mb-2" />
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
            <p className="text-[11px] text-muted mb-1">{MENU_CHANNEL_LABEL[c].en}</p>
            <PriceCell item={item} channel={c} canEdit={canEdit} onChanged={onChanged} />
          </div>
        ))}
      </div>
      {showMargin && cost !== undefined && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted">Cost {vnd(cost)}</span>
          {margin !== null && (
            <span className={margin >= 0 ? "text-success font-semibold" : "text-danger font-semibold"}>Margin {vnd(margin)}</span>
          )}
        </div>
      )}
    </Card>
  );
}

function AddMenuItemForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<RecipeCategory>("main");

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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name · Tên"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as RecipeCategory)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm bg-surface focus:outline-none focus:border-brand"
      >
        {(Object.keys(MENU_CATEGORY_LABEL) as RecipeCategory[]).map((c) => (
          <option key={c} value={c}>
            {MENU_CATEGORY_LABEL[c].en}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            addMenuItem(name.trim(), category);
            setName("");
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
  const [reprint, setReprint] = useState(false);
  const refresh = () => {
    setItems(getMenuItems());
    setReprint(getReprintFlag());
  };

  useEffect(() => refresh(), []);

  const grouped = (Object.keys(MENU_CATEGORY_LABEL) as RecipeCategory[])
    .map((cat) => [cat, items.filter((i) => i.category === cat)] as const)
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
              className="text-xs font-semibold text-warning underline shrink-0"
              onClick={() => {
                setReprintFlag(false);
                refresh();
              }}
            >
              Mark reprinted
            </button>
          )}
        </Card>
      )}
      {canEdit && <AddMenuItemForm onAdded={refresh} />}
      <div className="space-y-5">
        {grouped.map(([cat, list]) => (
          <div key={cat}>
            <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">{MENU_CATEGORY_LABEL[cat].en}</h2>
            <div className="space-y-2">
              {list.map((item) => (
                <MenuItemCard key={item.id} item={item} canEdit={canEdit} showMargin={showMargin} onChanged={refresh} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialsTab({ canEdit }: { canEdit: boolean }) {
  const [materials, setMaterials] = useState<PrintedMaterial[]>([]);
  const refresh = () => setMaterials(getPrintedMaterials());
  useEffect(() => refresh(), []);

  return (
    <Card className="p-0 divide-y divide-border">
      <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-muted font-semibold">
        <span>Item</span>
        <span className="text-center">On Hand</span>
        <span className="text-center">Par</span>
        <span className="text-center">Status</span>
      </div>
      {materials.map((m) => {
        const low = m.onHand <= m.reorderPoint;
        return (
          <div key={m.id} className="grid grid-cols-4 gap-2 px-4 py-3 items-center">
            <Bi value={m.name} className="text-sm" mode="inline" />
            <div className="text-center">
              <input
                type="number"
                inputMode="numeric"
                disabled={!canEdit}
                value={m.onHand}
                onChange={(e) => {
                  updatePrintedMaterial(m.id, { onHand: Number(e.target.value) || 0 });
                  refresh();
                }}
                className="w-16 text-center border-2 border-border rounded-lg py-1 text-sm font-bold tabular-nums disabled:opacity-60"
              />
            </div>
            <span className="text-center tabular-nums text-sm text-muted">{m.par}</span>
            <div className="text-center">
              {low ? (
                <Badge tone="warning">
                  <AlertTriangle size={12} /> Reorder
                </Badge>
              ) : (
                <Badge tone="success">
                  <CheckCircle2 size={12} /> OK
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </Card>
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
