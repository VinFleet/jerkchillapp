"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, Rocket } from "lucide-react";
import { getReceiptSettings } from "@/lib/repo/receiptSettings";
import { getMenuItems } from "@/lib/repo/menu";
import { getCachedTables } from "@/lib/repo/tableCache";
import { getStaff } from "@/lib/repo/staff";
import { vietQrConfigured } from "@/lib/repo/paymentSettings";
import { getPrinterSettings } from "@/lib/repo/printerSettings";
import { isLegacyTenant } from "@/lib/storage";

/**
 * The first-hour checklist for a fresh branch.
 *
 * A neutral branch starts empty on purpose — no borrowed menu, no borrowed
 * staff. Empty is correct and also silent: nothing on the home screen says
 * what to do first. This card is that voice, and it argues itself out of a
 * job — each step disappears into a tick, and the card leaves when the till
 * can actually run a service (named, menu, tables, staff, payment QR).
 * Printers stay listed but optional; plenty of places start without one.
 */

type Step = {
  href: string;
  en: string;
  vi: string;
  done: boolean;
  optional?: boolean;
};

export function GettingStarted() {
  // Computed in an effect, not render: these read localStorage and one of
  // them seeds defaults on first read — impure by design, so render-pure.
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    if (isLegacyTenant()) return;
    const staff = getStaff(true);
    const placeholderStaff =
      staff.length === 0 || staff.some((s) => s.name.toLowerCase().includes("rename me"));
    setSteps([
      {
        href: "/settings/receipt",
        en: "Name the restaurant",
        vi: "Đặt tên nhà hàng",
        done: getReceiptSettings().headerName.trim().length > 0,
      },
      {
        href: "/menu",
        en: "Add your menu & prices",
        vi: "Thêm thực đơn & giá",
        done: getMenuItems(false).length > 0,
      },
      {
        href: "/bookings",
        en: "Lay out your tables",
        vi: "Tạo sơ đồ bàn",
        done: getCachedTables().length > 0,
      },
      {
        href: "/staff",
        en: "Add your team",
        vi: "Thêm nhân viên",
        done: !placeholderStaff,
      },
      {
        href: "/settings/payments",
        en: "Bank account for QR payment",
        vi: "Tài khoản nhận chuyển khoản",
        done: vietQrConfigured(),
      },
      {
        href: "/settings/printing",
        en: "Connect printers",
        vi: "Kết nối máy in",
        done: getPrinterSettings().printers.some((p) => p.enabled && p.host),
        optional: true,
      },
    ]);
  }, []);

  if (!steps) return null;
  const required = steps.filter((s) => !s.optional);
  if (required.every((s) => s.done)) return null;
  const doneCount = required.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border-2 border-brand bg-surface overflow-hidden">
      <div className="px-4 py-3 bg-brand-tint flex items-center gap-2.5">
        <Rocket size={18} className="text-brand shrink-0" />
        <div>
          <p className="font-bold text-sm">
            Getting started <span className="text-muted font-normal">· Bắt đầu</span>
          </p>
          <p className="text-xs text-muted">
            {doneCount}/{required.length} — ready for first service · sẵn sàng cho ca đầu tiên
          </p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="flex items-center gap-3 px-4 min-h-[52px] active:bg-brand-light"
          >
            {step.done ? (
              <CheckCircle2 size={20} className="text-success shrink-0" />
            ) : (
              <Circle size={20} className="text-border shrink-0" />
            )}
            <span className={`flex-1 text-sm ${step.done ? "text-muted line-through" : "font-semibold"}`}>
              {step.en} <span className="text-muted font-normal">· {step.vi}</span>
              {step.optional && !step.done && (
                <span className="text-muted font-normal text-xs"> (optional · tùy chọn)</span>
              )}
            </span>
            {!step.done && <ChevronRight size={16} className="text-muted shrink-0" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
