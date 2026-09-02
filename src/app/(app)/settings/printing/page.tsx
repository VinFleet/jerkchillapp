"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Printer, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import {
  getPrinterSettings,
  savePrinterSettings,
  looksLikeHost,
} from "@/lib/repo/printerSettings";
import { printTest, recentPrintJobs, bridgeSeenAt, bridgeLooksDown, type PrintJobRow } from "@/lib/print/jobs";
import { nativePrintAvailable } from "@/lib/print/native";
import type { PrinterSettings } from "@/lib/types";

/**
 * The printers, managed where the people are.
 *
 * The bridge machine sits in a corner; the person who learns an IP changed is
 * standing at the till. So the addresses live here, sync like everything
 * else, and the bridge picks them up within fifteen seconds — changing a
 * printer never means touching the machine in the corner.
 *
 * Bridge health comes from two directions that cannot both lie: the bridge's
 * own 15-second heartbeat, and the queue itself — a job sitting "queued" for
 * half a minute is a down bridge whatever the heartbeat says.
 */

const PRINTER_LABEL: Record<string, { en: string; vi: string }> = {
  kitchen: { en: "Kitchen ticket printer", vi: "Máy in bếp" },
  receipt: { en: "Receipt printer", vi: "Máy in hoá đơn" },
  bar: { en: "Bar printer (drinks)", vi: "Máy in quầy bar (đồ uống)" },
};

function PrintingContent() {
  const { session } = useSession();
  const [form, setForm] = useState<PrinterSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PrintJobRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [heartbeat, setHeartbeat] = useState<string | null>(null);

  const loadJobs = useCallback(() => {
    void recentPrintJobs().then((rows) => {
      setJobs(rows);
      setFetchedAt(Date.now());
    });
    void bridgeSeenAt().then(setHeartbeat);
  }, []);

  useEffect(() => {
    setForm(getPrinterSettings());
    loadJobs();
    const t = setInterval(loadJobs, 5000);
    return () => clearInterval(t);
  }, [loadJobs]);

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

  const patchPrinter = (key: string, patch: Partial<PrinterSettings["printers"][number]>) => {
    setForm({
      ...form,
      printers: form.printers.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    });
    setSaved(false);
  };

  const stuckQueued = jobs.filter(
    (j) => j.status === "queued" && fetchedAt - new Date(j.created_at).getTime() > 30_000
  ).length;
  const lastDone = jobs.find((j) => j.status === "done");
  const heartbeatDown = fetchedAt > 0 && bridgeLooksDown(heartbeat, fetchedAt);
  const heartbeatFresh = fetchedAt > 0 && heartbeat !== null && !heartbeatDown;

  return (
    <div className="pb-10">
      <BackLink href="/settings" label="Settings" />
      <PageHeader
        title="Printing · In Ấn"
        subtitle="Printers & auto-print · Máy in & in tự động"
      />

      <div className="px-4 md:px-8 max-w-xl space-y-4">
        {nativePrintAvailable() && (
          <p className="flex items-center gap-2 text-sm rounded-xl border border-success bg-success-tint text-success px-3 py-2.5 font-semibold">
            <CheckCircle2 size={16} className="shrink-0" />
            This till prints directly — no bridge needed · Máy này in trực tiếp, không cần bridge
          </p>
        )}
        {/* Bridge health, from the queue itself */}
        {stuckQueued > 0 || heartbeatDown ? (
          <p className="flex items-start gap-2 text-sm rounded-xl border border-warning bg-warning-tint text-warning px-3 py-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {stuckQueued > 0
              ? `${stuckQueued} job${stuckQueued === 1 ? "" : "s"} waiting over 30s — the print bridge looks offline. Is it running on its machine?`
              : "The bridge has stopped checking in — tickets will queue, not print."}
            <br />
            Cầu in có vẻ chưa chạy — kiểm tra máy chạy bridge.
          </p>
        ) : heartbeatFresh ? (
          <p className="flex items-center gap-2 text-sm rounded-xl border border-border px-3 py-2.5 text-muted">
            <CheckCircle2 size={16} className="text-success shrink-0" />
            Bridge alive — checked in{" "}
            {Math.max(0, Math.round((fetchedAt - new Date(heartbeat!).getTime()) / 1000))}s
            ago · Cầu in đang chạy
          </p>
        ) : lastDone ? (
          <p className="flex items-center gap-2 text-sm rounded-xl border border-border px-3 py-2.5 text-muted">
            <CheckCircle2 size={16} className="text-success shrink-0" />
            Bridge alive — last print{" "}
            {Math.max(0, Math.round((fetchedAt - new Date(lastDone.created_at).getTime()) / 60000))}m
            ago · Cầu in đang chạy
          </p>
        ) : null}

        {form.printers.map((printer) => (
          <div key={printer.key} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">
                {PRINTER_LABEL[printer.key]?.en}{" "}
                <span className="text-muted font-normal">· {PRINTER_LABEL[printer.key]?.vi}</span>
              </p>
              <button
                onClick={() => patchPrinter(printer.key, { enabled: !printer.enabled })}
                className={`text-xs font-bold px-3 min-h-[36px] rounded-full ${
                  printer.enabled ? "bg-success-tint text-success" : "bg-border text-muted"
                }`}
              >
                {printer.enabled ? "On · Bật" : "Off · Tắt"}
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-muted">IP address · Địa chỉ IP</span>
              <input
                value={printer.host}
                onChange={(e) => patchPrinter(printer.key, { host: e.target.value.trim() })}
                inputMode="decimal"
                placeholder="192.168.1.199"
                className="w-full min-h-[52px] rounded-xl border border-border px-4 font-mono tabular-nums"
              />
              {printer.host && !looksLikeHost(printer.host) && (
                <span className="text-xs text-warning">
                  That does not look like an address · Không giống địa chỉ IP
                </span>
              )}
            </label>

            <div className="flex gap-2">
              {[32, 42, 48].map((w) => (
                <button
                  key={w}
                  onClick={() => patchPrinter(printer.key, { width: w })}
                  className={`flex-1 min-h-[44px] rounded-xl border text-sm ${
                    printer.width === w ? "border-brand text-brand font-bold" : "border-border"
                  }`}
                >
                  {w === 32 ? "58mm" : `80mm·${w}`}
                </button>
              ))}
            </div>

            {/* Vietnamese needs the printer's firmware to have code page 1258.
                ASCII always works, so it stays the default; the test print
                carries a diacritics line that proves the toggle either way. */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  patchPrinter(printer.key, {
                    encoding: (printer.encoding ?? "ascii") === "ascii" ? "cp1258" : "ascii",
                  })
                }
                className={`flex-1 min-h-[44px] rounded-xl border text-sm ${
                  printer.encoding === "cp1258" ? "border-brand text-brand font-bold" : "border-border"
                }`}
              >
                {printer.encoding === "cp1258"
                  ? "Tiếng Việt có dấu · CP1258"
                  : "No diacritics · Không dấu (ASCII)"}
              </button>
              {printer.encoding === "cp1258" && (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  ESC t
                  <input
                    value={printer.codepageByte ?? 94}
                    onChange={(e) =>
                      patchPrinter(printer.key, { codepageByte: Number(e.target.value) || 0 })
                    }
                    inputMode="numeric"
                    className="w-16 min-h-[44px] rounded-xl border border-border px-2 text-center font-mono tabular-nums text-sm text-foreground"
                  />
                </label>
              )}
            </div>
            {printer.encoding === "cp1258" && (
              <p className="text-xs text-muted">
                If the test prints symbols instead of dấu, try 94, 30 or 21 — printers disagree.
                · Nếu in ra ký hiệu lạ, thử 94, 30 hoặc 21.
              </p>
            )}

            <button
              onClick={() => {
                setTesting(printer.key);
                void printTest(printer.key).then((queued) => {
                  setTesting(null);
                  setNote(
                    queued
                      ? "Test sent — listen for the printer · Đã gửi bản in thử"
                      : "Could not queue the test — offline? · Không gửi được"
                  );
                  loadJobs();
                  window.setTimeout(() => setNote(null), 3000);
                });
              }}
              disabled={testing === printer.key}
              className="w-full min-h-[48px] rounded-xl border border-border font-semibold text-sm flex items-center justify-center gap-2"
            >
              {testing === printer.key ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Printer size={15} />
              )}
              Test print · In thử
            </button>
          </div>
        ))}

        {note && <p className="text-sm text-center text-muted">{note}</p>}

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          {(
            [
              [
                "autoPrintKitchen",
                "Kitchen ticket prints on Send",
                "Phiếu bếp tự in khi gửi món",
              ],
              [
                "autoPrintReceiptOnClose",
                "Receipt prints when a table closes",
                "Hoá đơn tự in khi đóng bàn",
              ],
            ] as const
          ).map(([key, en, vi]) => (
            <button
              key={key}
              onClick={() => {
                setForm({ ...form, [key]: !form[key] });
                setSaved(false);
              }}
              className="w-full flex items-center justify-between gap-3 min-h-[48px] text-left"
            >
              <span>
                <span className="block text-sm font-semibold">{en}</span>
                <span className="block text-xs text-muted">{vi}</span>
              </span>
              <span
                className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${form[key] ? "bg-brand" : "bg-border"}`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${form[key] ? "translate-x-5" : ""}`}
                />
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            savePrinterSettings(form);
            setForm(getPrinterSettings());
            setSaved(true);
          }}
          className="w-full min-h-[52px] rounded-xl bg-brand text-white font-semibold"
        >
          {saved ? "Saved — bridge picks it up in ~15s · Đã lưu" : "Save · Lưu"}
        </button>

        {jobs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted">Recent jobs · Lệnh in gần đây</p>
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-muted">
                  {j.printer} ·{" "}
                  {new Date(j.created_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={
                    j.status === "done"
                      ? "text-success font-semibold"
                      : j.status === "failed"
                        ? "text-danger font-semibold"
                        : "text-warning font-semibold"
                  }
                  title={j.error ?? undefined}
                >
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrintingPage() {
  return <PrintingContent />;
}
