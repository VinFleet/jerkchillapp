"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, XCircle, AlertTriangle, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FoodSafetyLogGate } from "@/components/FoodSafetyLogGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BigCheckbox } from "@/components/ui/BigCheckbox";
import { PhotoField } from "@/components/ui/PhotoField";
import { StoredPhoto } from "@/components/ui/StoredPhoto";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { useSession } from "@/lib/auth/RoleContext";
import { canEnterFoodSafetyLog } from "@/lib/auth/permissions";
import { getDeliveryLogs, logDelivery } from "@/lib/repo/foodSafety";
import { getSuppliers, getRejections, logRejection } from "@/lib/repo/suppliers";
import { getSupplyItems, receiveSupply } from "@/lib/repo/shopping";
import { todayIso } from "@/lib/storage";
import type { DeliveryLog, DeliveryLogItem, Supplier, SupplyItem, PhotoRef } from "@/lib/types";

const CUSTOM_ITEM = "__custom__";

function ItemPicker({ items, onAdd }: { items: SupplyItem[]; onAdd: (item: DeliveryLogItem) => void }) {
  const [selected, setSelected] = useState("");
  const [customName, setCustomName] = useState("");
  const [qty, setQty] = useState("");

  const isCustom = selected === CUSTOM_ITEM;
  const supplyItem = items.find((i) => i.id === selected);
  const unit = isCustom ? "" : supplyItem?.unit ?? "";

  const add = () => {
    const q = Number(qty);
    if (!q || q <= 0) return;
    if (isCustom) {
      if (!customName.trim()) return;
      onAdd({ name: customName.trim(), qty: q, unit: "" });
    } else if (supplyItem) {
      onAdd({ supplyItemId: supplyItem.id, name: `${supplyItem.name.en} · ${supplyItem.name.vi}`, qty: q, unit: supplyItem.unit });
    } else {
      return;
    }
    setSelected("");
    setCustomName("");
    setQty("");
  };

  return (
    <div className="mb-3 p-3 rounded-xl bg-black/5 dark:bg-white/5">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand bg-surface"
      >
        <option value="">Select item · Chọn mặt hàng</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name.en} · {i.name.vi}
          </option>
        ))}
        <option value={CUSTOM_ITEM}>Other (type item) · Khác (nhập tên)</option>
      </select>
      {isCustom && (
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Item name · Tên mặt hàng"
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
        />
      )}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={`Qty${unit ? ` (${unit})` : ""} · Số lượng`}
          className="flex-1 min-h-11 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
        <Button type="button" variant="secondary" className="min-h-11 px-4" disabled={!selected || (isCustom && !customName.trim()) || !qty} onClick={add}>
          <Plus size={16} /> Add · Thêm
        </Button>
      </div>
    </div>
  );
}

function AddForm({ onAdded, staffName, suppliers }: { onAdded: () => void; staffName: string; suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<DeliveryLogItem[]>([]);
  const [tempC, setTempC] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [tempOk, setTempOk] = useState(false);
  const [packagingOk, setPackagingOk] = useState(false);
  const [useByOk, setUseByOk] = useState(false);
  const [reason, setReason] = useState("");
  const [invoicePhoto, setInvoicePhoto] = useState<PhotoRef[]>([]);
  const [productPhotos, setProductPhotos] = useState<PhotoRef[]>([]);
  const [signature, setSignature] = useState("");
  const [allSupplyItems, setAllSupplyItems] = useState<SupplyItem[]>([]);

  useEffect(() => {
    if (open) setAllSupplyItems(getSupplyItems());
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Log a delivery · Ghi nhận hàng
      </button>
    );
  }

  const pickerItems = supplierId ? allSupplyItems.filter((i) => !i.supplierId || i.supplierId === supplierId) : allSupplyItems;
  const accepted = tempOk && packagingOk && useByOk;
  const reset = () => {
    setSupplierId("");
    setItems([]);
    setTempC("");
    setInvoiceNumber("");
    setTempOk(false);
    setPackagingOk(false);
    setUseByOk(false);
    setReason("");
    setInvoicePhoto([]);
    setProductPhotos([]);
    setSignature("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New delivery · Nhận hàng mới</p>
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand bg-surface"
      >
        <option value="">Select supplier · Chọn nhà cung cấp</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <p className="text-xs font-semibold text-muted mb-1.5">Items received · Mặt hàng nhận</p>
      <ItemPicker items={pickerItems} onAdd={(item) => setItems((prev) => [...prev, item])} />
      {items.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-sm">
              <span className="flex-1">
                {it.name} — {it.qty} {it.unit}
              </span>
              <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <PhotoField
        label={{ en: "Photo of invoice / delivery note", vi: "Ảnh hóa đơn / phiếu giao hàng" }}
        photos={invoicePhoto}
        onChange={setInvoicePhoto}
        max={1}
        context="delivery invoice"
      />
      <PhotoField
        label={{ en: "Photos of products received", vi: "Ảnh sản phẩm nhận được" }}
        photos={productPhotos}
        onChange={setProductPhotos}
        context="delivery products"
      />

      <div className="flex gap-2 mb-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={tempC}
          onChange={(e) => setTempC(e.target.value)}
          placeholder="Temp °C"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
        <input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder="Invoice # · Số hóa đơn"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <div className="space-y-2 mb-3">
        <BigCheckbox
          label={{ en: "Temperature OK", vi: "Nhiệt độ đạt" }}
          checked={tempOk}
          onToggle={() => setTempOk((v) => !v)}
        />
        <BigCheckbox
          label={{ en: "Packaging OK", vi: "Bao bì đạt" }}
          checked={packagingOk}
          onToggle={() => setPackagingOk((v) => !v)}
        />
        <BigCheckbox
          label={{ en: "Use-by date OK", vi: "Hạn sử dụng đạt" }}
          checked={useByOk}
          onToggle={() => setUseByOk((v) => !v)}
        />
      </div>
      {!accepted && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason · Lý do từ chối"
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
        />
      )}
      <SignaturePad
        label={{ en: `Sign to confirm the check — ${staffName}`, vi: `Ký xác nhận đã kiểm tra — ${staffName}` }}
        value={signature}
        onChange={setSignature}
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1"
          disabled={!supplierId || items.length === 0 || !signature}
          onClick={() => {
            logDelivery({
              supplierId,
              date: todayIso(),
              items,
              tempC: tempC.trim() === "" ? undefined : Number(tempC),
              invoiceNumber: invoiceNumber.trim() || undefined,
              tempOk,
              packagingOk,
              useByOk,
              accepted,
              rejectionReason: accepted ? undefined : reason.trim() || undefined,
              supplierNotified: accepted ? undefined : false,
              invoicePhotoRef: invoicePhoto[0],
              productPhotoRefs: productPhotos.length > 0 ? productPhotos : undefined,
              signature,
              loggedBy: staffName,
            });
            // An accepted delivery is the moment stock actually arrives, so
            // top up what's on hand here rather than making someone count it
            // again on the Shopping List. Rejected goods never went in.
            if (accepted) {
              for (const it of items) {
                if (it.supplyItemId) receiveSupply(it.supplyItemId, it.qty);
              }
            }
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

function RejectionNudge({ log, staffName, onLogged }: { log: DeliveryLog; staffName: string; onLogged: () => void }) {
  const [hasRejection, setHasRejection] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState("");
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    setHasRejection(getRejections(log.supplierId).some((r) => r.deliveryLogId === log.id));
  }, [log.id, log.supplierId]);

  if (hasRejection) {
    return (
      <p className="text-xs text-success flex items-center gap-1 mt-2">
        <CheckCircle2 size={12} /> Goods rejection record logged · Đã ghi hồ sơ từ chối hàng
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-danger font-semibold mt-2">
        <AlertTriangle size={12} /> Log required: goods rejection record · Cần ghi hồ sơ từ chối hàng
      </button>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <input
        value={actionTaken}
        onChange={(e) => setActionTaken(e.target.value)}
        placeholder="Action taken · Hành động đã thực hiện"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 text-sm"
      />
      <button
        onClick={() => setNotified((v) => !v)}
        className={`w-full min-h-10 rounded-xl border-2 font-semibold text-xs ${
          notified ? "bg-brand text-white border-brand" : "border-border text-muted"
        }`}
      >
        {notified ? "✓ Supplier notified" : "Supplier notified?"}
      </button>
      <Button
        className="w-full min-h-10 text-sm"
        disabled={!actionTaken.trim()}
        onClick={() => {
          logRejection({
            supplierId: log.supplierId,
            deliveryLogId: log.id,
            reason: log.rejectionReason ?? "Delivery rejected",
            actionTaken: actionTaken.trim(),
            supplierNotified: notified,
            loggedBy: staffName,
          });
          setHasRejection(true);
          setOpen(false);
          onLogged();
        }}
      >
        Save rejection record · Lưu hồ sơ
      </Button>
    </div>
  );
}

function DeliveriesContent() {
  const { session } = useSession();
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const refresh = () => setLogs(getDeliveryLogs());

  useEffect(() => {
    setSuppliers(getSuppliers());
    refresh();
  }, []);

  if (!session) return null;
  const canEnter = canEnterFoodSafetyLog(session.role, "deliveries");
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Delivery / Receiving · Nhận Hàng"
        subtitle="Check every delivery on arrival · Kiểm tra mọi lô hàng khi đến"
      />
      <div className="px-4 md:px-8">
        {canEnter && <AddForm onAdded={refresh} staffName={session.name} suppliers={suppliers} />}
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="font-semibold text-sm">{supplierName(log.supplierId)}</p>
                {log.accepted ? (
                  <Badge tone="success">
                    <CheckCircle2 size={12} /> Accepted
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <XCircle size={12} /> Rejected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                {log.date} · {log.loggedBy}
                {log.tempC !== undefined && ` · ${log.tempC}°C`}
              </p>
              {log.items && log.items.length > 0 ? (
                <ul className="text-sm mt-1 space-y-0.5">
                  {log.items.map((it, i) => (
                    <li key={i}>
                      {it.name} — {it.qty} {it.unit}
                    </li>
                  ))}
                </ul>
              ) : (
                log.itemsDescription && (
                  <p className="text-sm mt-1">
                    {log.itemsDescription}
                    {log.qty && ` · ${log.qty}`}
                  </p>
                )
              )}
              {log.invoiceNumber && <p className="text-xs text-muted mt-1">Invoice #{log.invoiceNumber}</p>}
              {!log.accepted && log.rejectionReason && (
                <p className="text-sm text-danger mt-2">{log.rejectionReason}</p>
              )}
              {log.invoiceNote && <p className="text-sm text-muted mt-2">{log.invoiceNote}</p>}
              {(log.invoicePhotoRef || (log.productPhotoRefs && log.productPhotoRefs.length > 0)) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {log.invoicePhotoRef && <StoredPhoto photo={log.invoicePhotoRef} alt="Invoice / delivery note" />}
                  {log.productPhotoRefs?.map((ref) => (
                    <StoredPhoto key={ref.id} photo={ref} alt="Product received" />
                  ))}
                </div>
              )}
              {log.signature && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted mb-1">Signed by {log.loggedBy} · Chữ ký của {log.loggedBy}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={log.signature} alt="Signature" className="h-10 bg-white rounded border border-border" />
                </div>
              )}
              {!log.accepted && canEnter && <RejectionNudge log={log} staffName={session.name} onLogged={refresh} />}
            </Card>
          ))}
          {logs.length === 0 && <p className="text-muted text-center py-10 text-sm">No deliveries logged yet · Chưa có lô hàng nào</p>}
        </div>
      </div>
    </div>
  );
}

export default function DeliveriesPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyLogGate log="deliveries">
        <DeliveriesContent />
      </FoodSafetyLogGate>
    </RoleGate>
  );
}
