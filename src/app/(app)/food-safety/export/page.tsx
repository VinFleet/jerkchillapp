"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Printer, ShieldAlert } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditSuppliers } from "@/lib/auth/permissions";
import { FOOD_SAFETY_LOG_LABEL, FOOD_SAFETY_LOG_ORDER } from "@/lib/foodSafetyLabels";
import {
  getTempReadingsInRange,
  getCookLogsInRange,
  getDeliveryLogsInRange,
  getCleaningSignoffsInRange,
  getInspectionsInRange,
  getSamplesInRange,
  getPestInRange,
  getComplaintsInRange,
  getFridgeUnits,
  getCleaningTasks,
  inspectionPassed,
} from "@/lib/repo/foodSafety";
import { getSuppliers } from "@/lib/repo/suppliers";
import { todayIso } from "@/lib/storage";
import type { FoodSafetyLogType } from "@/lib/types";

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

const RANGE_OPTIONS = [7, 30, 90] as const;

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-bold uppercase tracking-wide border border-border px-2 py-1.5 bg-brand-light print:bg-white">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`text-sm border border-border px-2 py-1.5 align-top ${className}`}>{children}</td>;
}

function ExportTable({ type, from, to }: { type: FoodSafetyLogType; from: string; to: string }) {
  const units = useMemo(() => getFridgeUnits(), []);
  const tasks = useMemo(() => getCleaningTasks(), []);
  const suppliers = useMemo(() => getSuppliers(), []);
  const unitName = (id: string) => units.find((u) => u.id === id)?.name.en ?? id;
  const taskName = (id: string) => tasks.find((t) => t.id === id)?.area.en ?? id;
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;

  if (type === "temperature") {
    const rows = getTempReadingsInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Date</Th><Th>Slot</Th><Th>Unit</Th><Th>Temp °C</Th><Th>Result</Th><Th>Corrective action</Th><Th>Logged by</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.date}</Td><Td>{r.timeSlot.toUpperCase()}</Td><Td>{unitName(r.unitId)}</Td><Td>{r.tempC}</Td>
              <Td>{r.inRange ? "OK" : "OUT OF RANGE"}</Td><Td>{r.correctiveAction ?? "—"}</Td><Td>{r.loggedBy}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "cooking") {
    const rows = getCookLogsInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>Logged</Th><Th>Dish</Th><Th>Batch</Th><Th>Probe °C</Th><Th>Target met (≥75°C)</Th><Th>Logged by</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{new Date(r.loggedAt).toLocaleString()}</Td><Td>{r.dish}</Td><Td>{r.batchLabel}</Td>
              <Td>{r.probeTempC}</Td><Td>{r.targetMet ? "Yes" : "NO"}</Td><Td>{r.loggedBy}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "deliveries") {
    const rows = getDeliveryLogsInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>Date</Th><Th>Supplier</Th><Th>Items</Th><Th>Temp °C</Th><Th>Invoice #</Th><Th>Packaging</Th><Th>Use-by</Th><Th>Result</Th><Th>Reason</Th><Th>Notified</Th><Th>Logged by</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.date}</Td><Td>{supplierName(r.supplierId)}</Td>
              <Td>{r.items && r.items.length > 0 ? r.items.map((it) => `${it.name} (${it.qty} ${it.unit})`).join(", ") : `${r.itemsDescription ?? ""}${r.qty ? ` · ${r.qty}` : ""}`}</Td>
              <Td>{r.tempC ?? "—"}</Td><Td>{r.invoiceNumber ?? "—"}</Td>
              <Td>{r.packagingOk ? "OK" : "FAIL"}</Td><Td>{r.useByOk ? "OK" : "FAIL"}</Td>
              <Td>{r.accepted ? "Accepted" : "REJECTED"}</Td><Td>{r.rejectionReason ?? "—"}</Td>
              <Td>{r.accepted ? "—" : r.supplierNotified ? "Yes" : "No"}</Td><Td>{r.loggedBy}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "cleaning") {
    const rows = getCleaningSignoffsInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>Date</Th><Th>Task</Th><Th>Signed by</Th><Th>Signed at</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.date}</Td><Td>{taskName(r.taskId)}</Td><Td>{r.signedBy}</Td><Td>{new Date(r.signedAt).toLocaleTimeString()}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "inspections") {
    const rows = getInspectionsInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>Date</Th><Th>Service</Th><Th>Stage</Th><Th>Meal</Th><Th>Detail</Th><Th>Result</Th><Th>Notes</Th><Th>Checked by</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const detail =
              r.stage === "before"
                ? `${r.ingredient ?? ""} · ${r.supplierSource ?? ""} · ${r.qty ?? ""}`
                : r.stage === "during"
                  ? `${r.startTime ?? ""}–${r.endTime ?? ""} · area ${r.areaHygieneOk ? "OK" : "FAIL"} · staff ${r.staffHygieneOk ? "OK" : "FAIL"}`
                  : `${r.dish ?? ""} · served ${r.timeServed ?? ""}`;
            return (
              <tr key={r.id}>
                <Td>{r.date}</Td><Td className="capitalize">{r.service}</Td><Td>{r.stage.replace("_", " ")}</Td>
                <Td>{r.meal}</Td><Td>{detail}</Td>
                <Td>{inspectionPassed(r) ? "Pass" : "FAIL"}</Td><Td>{r.notes ?? "—"}</Td><Td>{r.checkedBy}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (type === "samples") {
    const rows = getSamplesInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>Served</Th><Th>Dish</Th><Th>Qty</Th><Th>Storage</Th><Th>Discard by</Th><Th>Discarded</Th><Th>Logged by</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{new Date(r.servedAt).toLocaleString()}</Td><Td>{r.dish}</Td><Td>{r.qty}</Td><Td>{r.storageLocation}</Td>
              <Td>{new Date(r.discardBy).toLocaleString()}</Td>
              <Td>{r.discarded ? new Date(r.discardedAt as string).toLocaleString() : "NOT YET"}</Td><Td>{r.loggedBy}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === "pest") {
    const rows = getPestInRange(from, to);
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>Date</Th><Th>Location</Th><Th>Action taken</Th><Th>Reported to</Th><Th>Status</Th><Th>Logged by</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.date}</Td><Td>{r.location}</Td><Td>{r.action}</Td><Td>{r.reportedTo || "—"}</Td>
              <Td className="capitalize">{r.status}</Td><Td>{r.loggedBy}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const rows = getComplaintsInRange(from, to);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr><Th>Date</Th><Th>Guest</Th><Th>Category</Th><Th>Severity</Th><Th>Description</Th><Th>Investigation</Th><Th>Outcome</Th><Th>Logged by</Th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>{r.date}</Td><Td>{r.guestName}</Td><Td className="capitalize">{r.category}</Td>
            <Td className="capitalize">{r.severity}</Td><Td>{r.description}</Td>
            <Td>{r.investigation ?? "—"}</Td><Td>{r.outcome ?? "—"}</Td><Td>{r.loggedBy}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExportContent() {
  const { session } = useSession();
  const [type, setType] = useState<FoodSafetyLogType>("temperature");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
  }, [type, rangeDays]);

  if (!session) return null;

  if (!canEditSuppliers(session.role)) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }

  const to = todayIso();
  const from = daysAgoIso(rangeDays);

  return (
    <div className="pb-10">
      <div className="print:hidden">
        <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
        <PageHeader title="Export for inspection · Xuất Hồ Sơ Kiểm Tra" subtitle="Print or save as PDF · In hoặc lưu PDF" />
      </div>

      <div className="px-4 md:px-8 print:hidden space-y-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FOOD_SAFETY_LOG_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`min-h-11 px-4 rounded-full font-semibold text-sm border-2 shrink-0 ${
                type === t ? "bg-brand text-white border-brand" : "border-border text-muted"
              }`}
            >
              {FOOD_SAFETY_LOG_LABEL[t].en}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              className={`flex-1 min-h-11 rounded-xl font-semibold text-sm border-2 ${
                rangeDays === d ? "bg-brand-light text-brand border-brand" : "border-border text-muted"
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>
        <Button className="w-full" onClick={() => window.print()}>
          <Printer size={18} /> Print / Save as PDF · In / Lưu PDF
        </Button>
      </div>

      <div className="px-4 md:px-8">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-foreground">
          <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={64} height={45} />
          <div>
            <p className="font-bold">Jerk & Chill — Thảo Điền, District 2, HCMC</p>
            <p className="text-sm">
              {FOOD_SAFETY_LOG_LABEL[type].en} · {FOOD_SAFETY_LOG_LABEL[type].vi}
            </p>
            <p className="text-xs text-muted">
              {from} to {to} · Generated {generatedAt} by {session.name}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <ExportTable type={type} from={from} to={to} />
        </div>
      </div>
    </div>
  );
}

export default function ExportPage() {
  return (
    <RoleGate module="foodSafety">
      <ExportContent />
    </RoleGate>
  );
}
