"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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
import { getDeliveryLogs, logDelivery } from "@/lib/repo/foodSafety";
import { getSuppliers, getRejections, logRejection } from "@/lib/repo/suppliers";
import { todayIso } from "@/lib/storage";
import type { DeliveryLog, Supplier } from "@/lib/types";

function AddForm({ onAdded, staffName, suppliers }: { onAdded: () => void; staffName: string; suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [itemsDescription, setItemsDescription] = useState("");
  const [qty, setQty] = useState("");
  const [tempC, setTempC] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [tempOk, setTempOk] = useState(false);
  const [packagingOk, setPackagingOk] = useState(false);
  const [useByOk, setUseByOk] = useState(false);
  const [reason, setReason] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");

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

  const accepted = tempOk && packagingOk && useByOk;
  const reset = () => {
    setSupplierId("");
    setItemsDescription("");
    setQty("");
    setTempC("");
    setInvoiceNumber("");
    setTempOk(false);
    setPackagingOk(false);
    setUseByOk(false);
    setReason("");
    setInvoiceNote("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New delivery · Nhận hàng mới</p>
      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand bg-surface"
      >
        <option value="">Select supplier · Chọn nhà cung cấp</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={itemsDescription}
        onChange={(e) => setItemsDescription(e.target.value)}
        placeholder="Items · Mặt hàng"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2 mb-2">
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty · Số lượng"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={tempC}
          onChange={(e) => setTempC(e.target.value)}
          placeholder="Temp °C"
          className="w-28 min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
        />
      </div>
      <input
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
        placeholder="Invoice # · Số hóa đơn"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
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
          className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
        />
      )}
      <input
        value={invoiceNote}
        onChange={(e) => setInvoiceNote(e.target.value)}
        placeholder="Photo note (delivery + invoice) · Ghi chú ảnh"
        className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!supplierId || !itemsDescription.trim() || !qty.trim()}
          onClick={() => {
            logDelivery({
              supplierId,
              date: todayIso(),
              itemsDescription: itemsDescription.trim(),
              qty: qty.trim(),
              tempC: tempC.trim() === "" ? undefined : Number(tempC),
              invoiceNumber: invoiceNumber.trim() || undefined,
              tempOk,
              packagingOk,
              useByOk,
              accepted,
              rejectionReason: accepted ? undefined : reason.trim() || undefined,
              supplierNotified: accepted ? undefined : false,
              invoiceNote: invoiceNote.trim() || undefined,
              loggedBy: staffName,
            });
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
              </p>
              <p className="text-sm mt-1">
                {log.itemsDescription} · {log.qty}
                {log.tempC !== undefined && ` · ${log.tempC}°C`}
              </p>
              {log.invoiceNumber && <p className="text-xs text-muted">Invoice #{log.invoiceNumber}</p>}
              {!log.accepted && log.rejectionReason && (
                <p className="text-sm text-danger mt-2">{log.rejectionReason}</p>
              )}
              {log.invoiceNote && <p className="text-sm text-muted mt-2">{log.invoiceNote}</p>}
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
