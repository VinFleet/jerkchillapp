"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import {
  getReceiptSettings,
  saveReceiptSettings,
  DEFAULT_RECEIPT,
} from "@/lib/repo/receiptSettings";
import type { ReceiptSettings } from "@/lib/types";

/**
 * What prints on the bill.
 *
 * A form on the left of the fold and nothing clever: these fields change
 * once a year. The one live decision — print a scan-to-pay QR or not — sits
 * with the rest rather than in payments, because the person deciding is
 * thinking about what the paper looks like.
 */

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[52px] rounded-xl border border-border bg-surface px-4"
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-full min-h-[60px] rounded-xl border border-border bg-surface px-4 flex items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span
        className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${on ? "bg-brand" : "bg-border"}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}

function ReceiptContent() {
  const { session } = useSession();
  const [form, setForm] = useState<ReceiptSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(getReceiptSettings());
  }, []);

  if (!session) return null;
  if (session.role !== "owner" && session.role !== "manager") {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }
  if (!form) return null;

  const set = (patch: Partial<ReceiptSettings>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
  };

  return (
    <div className="pb-10">
      <BackLink href="/settings" label="Settings" />
      <PageHeader
        title="Receipt setup · Thiết Lập Hoá Đơn"
        subtitle="What prints on the bill · Nội dung in trên hoá đơn"
      />

      <div className="px-4 md:px-8 max-w-xl space-y-4">
        <Field
          label="Restaurant name · Tên nhà hàng"
          value={form.headerName}
          onChange={(v) => set({ headerName: v })}
          placeholder={DEFAULT_RECEIPT.headerName}
        />
        <Field
          label="Address · Địa chỉ"
          value={form.addressLine}
          onChange={(v) => set({ addressLine: v })}
          placeholder={DEFAULT_RECEIPT.addressLine}
        />
        <Field
          label="Phone · Điện thoại"
          value={form.phone}
          onChange={(v) => set({ phone: v })}
          placeholder="09xx xxx xxx"
        />
        <Field
          label="Tax code (MST) · Mã số thuế"
          value={form.taxCode}
          onChange={(v) => set({ taxCode: v })}
          placeholder="Printed only when filled in · Chỉ in khi có"
        />
        <Field
          label="Wifi line · Dòng wifi"
          value={form.wifiNote}
          onChange={(v) => set({ wifiNote: v })}
          placeholder="Wifi: JerkChill — password 12345678"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Footer (EN)"
            value={form.footer.en}
            onChange={(v) => set({ footer: { ...form.footer, en: v } })}
            placeholder={DEFAULT_RECEIPT.footer.en}
          />
          <Field
            label="Footer (VI)"
            value={form.footer.vi}
            onChange={(v) => set({ footer: { ...form.footer, vi: v } })}
            placeholder={DEFAULT_RECEIPT.footer.vi}
          />
        </div>

        <Toggle
          label="Print the logo · In logo"
          hint="The drumstick, centred at the top · Logo ở đầu hoá đơn"
          on={form.showLogo}
          onChange={(v) => set({ showLogo: v })}
        />
        <Toggle
          label="Scan-to-pay QR on the bill · Mã QR thanh toán"
          hint="A VietQR for the exact amount still owed — needs the bank account in Settings · Cần tài khoản ngân hàng"
          on={form.showPaymentQr}
          onChange={(v) => set({ showPaymentQr: v })}
        />

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              saveReceiptSettings(form);
              setForm(getReceiptSettings());
              setSaved(true);
            }}
            className="flex-1 min-h-[52px] rounded-xl bg-brand text-white font-semibold"
          >
            {saved ? "Saved · Đã lưu" : "Save · Lưu"}
          </button>
          <Link
            href="/service"
            className="min-h-[52px] px-4 rounded-xl border border-border font-semibold flex items-center gap-2"
          >
            <Printer size={16} /> Try it on a bill
          </Link>
        </div>
        <p className="text-xs text-muted">
          Changes reach every device the next time it syncs — the tablet prints the same header as
          the laptop. · Thay đổi tự đồng bộ tới mọi thiết bị.
        </p>
      </div>
    </div>
  );
}

export default function ReceiptSettingsPage() {
  return <ReceiptContent />;
}
