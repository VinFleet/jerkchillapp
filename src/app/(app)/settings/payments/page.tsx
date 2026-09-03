"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Check, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import { supabase } from "@/lib/supabase/client";
import { getActiveTenant } from "@/lib/storage";
import {
  getPaymentSettings,
  savePaymentSettings,
  type PaymentSettings,
} from "@/lib/repo/paymentSettings";
import { buildVietQrPayload, isValidVietQrPayload } from "@/lib/payments/vietqr";

/**
 * Where the money goes.
 *
 * Owner-only, and deliberately awkward to change: this is the one screen in
 * the app where a typo costs a night's takings rather than a correction. The
 * account is shown back in full — never masked — because the whole point of
 * this screen is that someone can check it against a bank statement.
 *
 * The test at the bottom builds a real payload from the entered details and
 * validates its checksum. It cannot prove the account belongs to the
 * restaurant, and says so; what it does prove is that the QR will scan, which
 * is the failure that would otherwise be found by a guest at a table.
 */

/** The banks a Thảo Điền restaurant is realistically paid into. */
const COMMON_BANKS: { bin: string; name: string }[] = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
];

function PaymentsContent() {
  const { session } = useSession();
  const [form, setForm] = useState<PaymentSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [hookState, setHookState] = useState<{ configured: boolean } | null>(null);
  const [hookReveal, setHookReveal] = useState<{ secret: string; webhookUrl: string } | null>(null);
  const [hookBusy, setHookBusy] = useState(false);

  useEffect(() => {
    setForm(getPaymentSettings());
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/payments/webhook-secret?branch=${encodeURIComponent(getActiveTenant())}`,
        { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } }
      );
      if (res.ok) setHookState((await res.json()) as { configured: boolean });
    })();
  }, []);

  if (!session) return null;

  if (session.role !== "owner") {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }

  if (!form) return null;

  const set = (patch: Partial<PaymentSettings>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
    setTestResult(null);
  };

  const save = () => {
    savePaymentSettings(form);
    setForm(getPaymentSettings());
    setSaved(true);
  };

  const runTest = () => {
    try {
      const payload = buildVietQrPayload({
        bankBin: form.bankBin.trim(),
        accountNumber: form.accountNumber.replace(/\s+/g, ""),
        amountVnd: 10_000,
        reference: "JCTEST1",
      });
      setTestResult(
        isValidVietQrPayload(payload)
          ? "Builds a valid QR. This checks the format, not that the account is yours — compare the number above against a bank statement."
          : "Built a payload that failed its own checksum. Do not use this."
      );
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Could not build a QR");
    }
  };

  const binLooksRight = /^\d{6}$/.test(form.bankBin.trim());
  const accountLooksRight = /^\d{6,20}$/.test(form.accountNumber.replace(/\s+/g, ""));

  return (
    <div className="pb-10">
      <BackLink href="/settings" label="Settings" />
      <PageHeader
        title="Bank transfers · Chuyển Khoản"
        subtitle="The account VietQR pays into · Tài khoản nhận tiền"
      />

      <div className="px-4 md:px-8 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold">
            Bank <span className="text-muted font-normal">· Ngân hàng</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {COMMON_BANKS.map((b) => (
              <button
                key={b.bin}
                onClick={() => set({ bankBin: b.bin })}
                className={`min-h-[52px] rounded-xl border px-3 text-sm text-left ${
                  form.bankBin === b.bin
                    ? "border-brand bg-brand-light font-semibold"
                    : "border-border"
                }`}
              >
                {b.name}
                <span className="block text-xs text-muted tabular-nums">{b.bin}</span>
              </button>
            ))}
          </div>
          <input
            value={form.bankBin}
            onChange={(e) => set({ bankBin: e.target.value })}
            inputMode="numeric"
            placeholder="Or a six-digit BIN · Hoặc mã BIN 6 số"
            className="w-full min-h-[52px] rounded-xl border border-border px-4 tabular-nums"
          />
          {form.bankBin && !binLooksRight && (
            <p className="text-xs text-amber-700">
              A bank BIN is exactly six digits · Mã BIN phải đúng 6 chữ số
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold">
            Account number <span className="text-muted font-normal">· Số tài khoản</span>
          </label>
          <input
            value={form.accountNumber}
            onChange={(e) => set({ accountNumber: e.target.value })}
            inputMode="numeric"
            className="w-full min-h-[52px] rounded-xl border border-border px-4 tabular-nums text-lg"
          />
          {form.accountNumber && !accountLooksRight && (
            <p className="text-xs text-amber-700">Digits only, 6–20 of them · Chỉ chữ số</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold">
            Account name <span className="text-muted font-normal">· Tên tài khoản</span>
          </label>
          <input
            value={form.accountName}
            onChange={(e) => set({ accountName: e.target.value })}
            placeholder="JERK AND CHILL"
            className="w-full min-h-[52px] rounded-xl border border-border px-4 uppercase"
          />
          <p className="text-xs text-muted">
            Shown in the guest&apos;s banking app before they confirm · Khách sẽ thấy tên này
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex-1 min-h-[52px] rounded-xl bg-brand text-white font-semibold active:scale-[0.98]"
          >
            {saved ? "Saved · Đã lưu" : "Save · Lưu"}
          </button>
          <button
            onClick={runTest}
            disabled={!binLooksRight || !accountLooksRight}
            className="flex-1 min-h-[52px] rounded-xl border border-border font-semibold active:scale-[0.98] disabled:opacity-40"
          >
            Test QR · Thử mã
          </button>
        </div>

        {/* The card terminal. Only the switch lives on the device — the
            merchant key, signing secret and checksum key are server-side
            per-branch secrets, because whoever holds the checksum key can
            forge a paid confirmation. */}
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
          <button
            onClick={() => set({ ninepayEnabled: !form.ninepayEnabled })}
            className="w-full flex items-center justify-between gap-3 min-h-[48px] text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Card terminal (9Pay)</span>
              <span className="block text-xs text-muted">Máy thẻ 9Pay</span>
            </span>
            <span
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                form.ninepayEnabled ? "bg-brand" : "bg-border"
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  form.ninepayEnabled ? "translate-x-5" : ""
                }`}
              />
            </span>
          </button>
          <p className="text-xs text-muted">
            The till sends the amount to the terminal and the bill settles itself, instead of
            ringing it up separately and typing the slip number back in.
            <br />
            Máy tính tiền gửi số tiền sang máy thẻ — hoá đơn tự khớp, không cần nhập tay.
          </p>
          {form.ninepayEnabled && (
            <p className="text-xs text-warning">
              Needs the branch&apos;s 9Pay keys installed on the server first — until then the
              charge button will say the terminal is not set up.
              <br />
              Cần cài khoá 9Pay cho chi nhánh trước.
            </p>
          )}
        </div>

        {/* Transfer self-confirmation: the branch's own webhook. The secret
            shows exactly once — a secret that can be re-read from a screen is
            a secret on every screenshot. */}
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
          <p className="text-sm font-semibold">
            Automatic confirmation <span className="text-muted font-normal">· Tự xác nhận chuyển khoản</span>
          </p>
          <p className="text-xs text-muted">
            A SePay or Casso account watching this bank account calls VINPOS when money lands, and
            the bill settles itself. Generate the key, paste both values into the provider.
            <br />
            Tài khoản SePay/Casso theo dõi ngân hàng sẽ tự xác nhận hoá đơn.
          </p>
          {hookState && (
            <p className="text-xs">
              {hookState.configured ? (
                <span className="text-success font-semibold">Key set for this branch · Đã có khoá</span>
              ) : (
                <span className="text-warning font-semibold">
                  No key yet — transfers need a waiter&apos;s eye until this is done · Chưa có khoá
                </span>
              )}
            </p>
          )}
          {hookReveal && (
            <div className="rounded-xl border border-warning bg-warning-tint p-3 space-y-1 text-xs">
              <p className="font-bold text-warning">Shown once — copy both now · Chỉ hiện một lần</p>
              <p className="font-mono break-all select-all">{hookReveal.secret}</p>
              <p className="font-mono break-all select-all">{hookReveal.webhookUrl}</p>
            </div>
          )}
          <button
            onClick={async () => {
              if (!supabase) return;
              setHookBusy(true);
              const { data } = await supabase.auth.getSession();
              const res = await fetch(
                `/api/payments/webhook-secret?branch=${encodeURIComponent(getActiveTenant())}`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
                }
              );
              setHookBusy(false);
              if (res.ok) {
                setHookReveal((await res.json()) as { secret: string; webhookUrl: string });
                setHookState({ configured: true });
              } else {
                setTestResult("Could not generate — owner or manager sign-in required.");
              }
            }}
            disabled={hookBusy}
            className="w-full min-h-[48px] rounded-xl border border-border font-semibold text-sm disabled:opacity-50"
          >
            {hookState?.configured
              ? "Rotate the key · Đổi khoá (old one stops working)"
              : "Generate the key · Tạo khoá"}
          </button>
        </div>

        {testResult && (
          <p className="flex items-start gap-2 text-sm rounded-xl border border-border px-3 py-2">
            {testResult.startsWith("Builds a valid") ? (
              <Check size={16} className="shrink-0 mt-0.5 text-green-700" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            )}
            {testResult}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PaymentsSettingsPage() {
  return <PaymentsContent />;
}
