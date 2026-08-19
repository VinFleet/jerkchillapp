"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle, Clock, CheckCircle2, Pencil } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getShoppingList,
  getUnconfirmedPricingCount,
  getStaleOrderItems,
  supplierName,
  addSupplyItem,
  updateSupplyItem,
  updateOrderingMeta,
  setSupplyOnHand,
  type ShoppingListRow,
} from "@/lib/repo/shopping";
import { getSuppliers } from "@/lib/repo/suppliers";
import type { Supplier } from "@/lib/types";

function EditMetaForm({ row, suppliers, onSaved }: { row: ShoppingListRow; suppliers: Supplier[]; onSaved: () => void }) {
  const [supplierId, setSupplierId] = useState(row.supplierId ?? "");
  const [packSize, setPackSize] = useState(row.packSize ?? "");
  const [packCost, setPackCost] = useState(row.packCostVnd !== null ? String(row.packCostVnd) : "");

  const save = () => {
    const patch = {
      supplierId: supplierId || undefined,
      packSize: packSize.trim() || undefined,
      packCostVnd: packCost.trim() === "" ? null : Number(packCost),
    };
    if (row.kind === "bar") updateOrderingMeta(row.id, patch);
    else updateSupplyItem(row.id, patch);
    onSaved();
  };

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm bg-surface"
      >
        <option value="">No supplier linked · Chưa gắn nhà cung cấp</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={packSize}
        onChange={(e) => setPackSize(e.target.value)}
        placeholder="Pack size · Quy cách đóng gói"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
      />
      <input
        type="number"
        inputMode="numeric"
        value={packCost}
        onChange={(e) => setPackCost(e.target.value)}
        placeholder="Pack cost VND · Giá gói (VND)"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
      />
      <Button className="w-full min-h-11 text-sm" onClick={save}>
        Save · Lưu
      </Button>
    </div>
  );
}

/** Quick stock count. Kitchen supplies only — bar counts come from the Stock Log. */
function CountControl({ row, onChanged }: { row: ShoppingListRow; onChanged: () => void }) {
  const [counting, setCounting] = useState(false);
  const [value, setValue] = useState(String(row.onHand));

  if (row.kind !== "supply") return null;

  if (!counting) {
    return (
      <button
        onClick={() => {
          setValue(String(row.onHand));
          setCounting(true);
        }}
        className="text-xs text-brand font-semibold"
      >
        Count · Đếm
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 min-h-11 rounded-xl border-2 border-brand px-2 text-sm text-center"
        aria-label={`On hand · ${row.name.en}`}
      />
      <span className="text-xs text-muted">{row.unit}</span>
      <Button
        className="min-h-11 px-3 text-sm"
        onClick={() => {
          setSupplyOnHand(row.id, Number(value) || 0);
          setCounting(false);
          onChanged();
        }}
      >
        Save · Lưu
      </Button>
      <button onClick={() => setCounting(false)} className="text-xs text-muted font-semibold">
        Cancel · Hủy
      </button>
    </div>
  );
}

function ShoppingRow({ row, suppliers, onChanged }: { row: ShoppingListRow; suppliers: Supplier[]; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const toOrder = Math.max(0, row.par - row.onHand);
  const supplier = suppliers.find((s) => s.id === row.supplierId);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Bi value={row.name} className="font-semibold text-sm" mode="inline" />
          <p className="text-xs text-muted mt-0.5">
            {row.onHand} / {row.par} {row.unit} · {supplierName(row.supplierId)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge tone="warning">
            <AlertTriangle size={12} /> Order {toOrder} {row.unit}
          </Badge>
          {supplier?.status === "replace" && (
            <Badge tone="danger">Supplier being replaced</Badge>
          )}
          {supplier?.status === "review" && (
            <Badge tone="warning">Supplier under review</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-muted">
          {row.packSize ? `${row.packSize} · ` : ""}
          {row.packCostVnd !== null ? `${row.packCostVnd.toLocaleString("vi-VN")}₫` : <span className="text-warning font-semibold">Unconfirmed price</span>}
        </span>
        <button onClick={() => setEditing((e) => !e)} className="flex items-center gap-1 text-brand font-semibold">
          <Pencil size={11} /> Edit · Sửa
        </button>
      </div>

      {editing && (
        <EditMetaForm
          row={row}
          suppliers={suppliers}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border flex-wrap">
        <span className="text-xs text-muted">
          {row.lastOrderedAt ? `Last ordered ${row.lastOrderedAt}` : "Never ordered · Chưa từng đặt"}
        </span>
        <div className="flex items-center gap-3">
          <CountControl row={row} onChanged={onChanged} />
          <Button
            variant="secondary"
            className="min-h-11 text-xs px-3"
            onClick={() => {
              row.markOrdered();
              onChanged();
            }}
          >
            <CheckCircle2 size={14} /> Mark ordered · Đã đặt
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AddSupplyForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [par, setPar] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add supply item · Thêm mặt hàng
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New kitchen supply · Nguyên liệu / vật tư mới</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name · Tên"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm"
      />
      <div className="flex gap-2 mb-3">
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit · Đơn vị (e.g. kg)"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm"
        />
        <input
          type="number"
          inputMode="numeric"
          value={par}
          onChange={(e) => setPar(e.target.value)}
          placeholder="Par · Định mức"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim() || !unit.trim() || !par.trim()}
          onClick={() => {
            addSupplyItem(name.trim(), unit.trim(), Number(par));
            setName("");
            setUnit("");
            setPar("");
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

function ShoppingContent() {
  const [rows, setRows] = useState<ShoppingListRow[]>([]);
  const [staleCount, setStaleCount] = useState(0);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const refresh = () => {
    setRows(getShoppingList());
    setStaleCount(getStaleOrderItems().length);
    setUnconfirmedCount(getUnconfirmedPricingCount());
  };

  useEffect(() => {
    setSuppliers(getSuppliers());
    refresh();
  }, []);

  const NO_SUPPLIER = "No supplier linked · Chưa gắn nhà cung cấp";
  const grouped = rows.reduce<Record<string, ShoppingListRow[]>>((acc, r) => {
    const key = r.supplierId ? supplierName(r.supplierId) : NO_SUPPLIER;
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="pb-6">
      <PageHeader title="Shopping List · Danh Sách Đặt Hàng" subtitle="Auto-generated from par levels · Tự động tạo từ định mức" />
      <div className="px-4 md:px-8">
        {(staleCount > 0 || unconfirmedCount > 0) && (
          <div className="space-y-2 mb-4">
            {unconfirmedCount > 0 && (
              <Card className="border-warning/40 bg-warning-tint flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning shrink-0" />
                <p className="text-sm font-semibold text-warning">{unconfirmedCount} item(s) with unconfirmed pricing · giá chưa xác nhận</p>
              </Card>
            )}
            {staleCount > 0 && (
              <Card className="border-muted/40 flex items-center gap-2">
                <Clock size={16} className="text-muted shrink-0" />
                <p className="text-sm text-muted">{staleCount} item(s) not ordered in 60+ days — review for cleanup</p>
              </Card>
            )}
          </div>
        )}

        <AddSupplyForm onAdded={refresh} />

        {Object.entries(grouped).map(([supplier, items]) => (
          <div key={supplier} className="mb-5">
            <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">{supplier}</h2>
            <div className="space-y-2">
              {items.map((r) => (
                <ShoppingRow key={r.key} row={r} suppliers={suppliers} onChanged={refresh} />
              ))}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-muted text-center py-10 text-sm">Nothing below par right now · Chưa có mặt hàng nào dưới định mức</p>
        )}
      </div>
    </div>
  );
}

export default function ShoppingPage() {
  return (
    <RoleGate module="shopping">
      <ShoppingContent />
    </RoleGate>
  );
}
