"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, RotateCcw, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/BackLink";
import { useSession } from "@/lib/auth/RoleContext";
import { getCachedTables, isRealTableId, type CachedTable } from "@/lib/repo/tableCache";
import {
  ensureToken,
  rotateToken,
  orderUrlFor,
  isPrintableOrigin,
  publicOrigin,
  dropPlaceholderTokens,
} from "@/lib/repo/tableTokens";

/**
 * The QR stickers that go on the tables.
 *
 * Printed once and then lived with for months, which sets the priorities: the
 * table number is large enough to read across the room while someone is
 * putting the right sticker on the right table, and the URL is printed
 * underneath in full so a phone that will not scan can still be typed into.
 *
 * Rotating a table's code invalidates the sticker currently on it. That is the
 * point — a guest who photographed the QR can otherwise order to that table
 * from home — but it means the sticker must be reprinted, so it asks first.
 */

function StickersContent() {
  const { session } = useSession();
  const [tables, setTables] = useState<CachedTable[]>([]);
  const [codes, setCodes] = useState<Record<string, { url: string; svg: string }>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [printable, setPrintable] = useState(true);
  const [origin, setOrigin] = useState("");

  const build = useCallback(async () => {
    // Clear anything an earlier run bound to a placeholder table before the
    // real floor plan arrived.
    dropPlaceholderTokens();
    const list = getCachedTables();
    setTables(list);

    const origin = window.location.origin;
    setPrintable(isPrintableOrigin(origin));
    setOrigin(publicOrigin(origin));
    const next: Record<string, { url: string; svg: string }> = {};

    await Promise.all(
      list.map(async (t) => {
        // Never mint a code against a placeholder id. The offline fallback is
        // there so the room is still legible without a connection, not so a
        // sticker can be bound to a table that does not exist yet.
        if (!isRealTableId(t.id)) return;
        const token = ensureToken(t.id);
        const url = orderUrlFor(token.token, origin);
        // SVG rather than a raster: these get printed, and a scaled-up PNG
        // scans badly. Error correction "M" tolerates a smudge or a thumbprint
        // without inflating the pattern to the point it stops being readable
        // at sticker size.
        next[t.id] = {
          url,
          svg: await QRCode.toString(url, {
            type: "svg",
            errorCorrectionLevel: "M",
            margin: 1,
          }),
        };
      })
    );

    setCodes(next);
  }, []);

  useEffect(() => {
    void build();
  }, [build]);

  const rotate = (tableId: string) => {
    rotateToken(tableId);
    setConfirming(null);
    void build();
  };

  const isOwnerOrManager = session?.role === "owner" || session?.role === "manager";

  return (
    <div className="pb-10">
      <BackLink href="/service" label="Service" />
      <PageHeader
        title="Table QR codes · Mã QR Bàn"
        subtitle="Print, cut, and stick one on each table · In và dán lên mỗi bàn"
        action={
          <button
            onClick={() => window.print()}
            disabled={!printable}
            title={printable ? undefined : "These codes point at this computer — open the live site to print"}
            className="min-h-[44px] px-4 rounded-xl border border-[var(--line)] flex items-center gap-2 text-sm font-semibold print:hidden disabled:opacity-40"
          >
            <Printer size={16} /> Print
          </button>
        }
      />

      {!printable && (
        <div className="px-4 md:px-8 mb-4 print:hidden">
          <p className="flex items-start gap-2 text-sm rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-900 px-3 py-2.5">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>
              <strong>Do not print these.</strong> They point at{" "}
              <span className="font-mono">{origin}</span>, which only exists on this computer — a
              guest scanning one would get nothing. Open this page on the live site before printing.
              <br />
              <span className="opacity-80">
                Đừng in — mã đang trỏ về máy này. Hãy mở trang này trên trang web thật rồi mới in.
              </span>
            </span>
          </p>
        </div>
      )}

      <div className="px-4 md:px-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:gap-6">
        {tables.map((t) => {
          const code = codes[t.id];
          return (
            <div
              key={t.id}
              className="border border-[var(--line)] rounded-2xl p-4 flex flex-col items-center gap-2 break-inside-avoid"
            >
              <span className="text-3xl font-black tracking-tight">{t.tableNumber}</span>
              {code ? (
                <div
                  className="w-full aspect-square [&>svg]:w-full [&>svg]:h-full"
                  // The QR is generated in this component from a token we
                  // created; nothing here comes from a guest or the network.
                  dangerouslySetInnerHTML={{ __html: code.svg }}
                />
              ) : isRealTableId(t.id) ? (
                <div className="w-full aspect-square bg-[var(--line)]/30 rounded animate-pulse" />
              ) : (
                <div className="w-full aspect-square rounded border border-dashed border-[var(--line)] grid place-items-center p-2 text-center">
                  <span className="text-xs text-muted">
                    Waiting for the floor plan
                    <br />
                    <span className="opacity-80">Đang chờ sơ đồ bàn</span>
                  </span>
                </div>
              )}
              <p className="text-[10px] text-muted text-center break-all leading-tight">
                {code?.url}
              </p>
              <p className="text-xs text-center">
                Scan to order <span className="text-muted">· Quét để gọi món</span>
              </p>

              {isOwnerOrManager && (
                <div className="print:hidden w-full">
                  {confirming === t.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => rotate(t.id)}
                        className="flex-1 min-h-[40px] rounded-lg bg-amber-600 text-white text-xs font-semibold"
                      >
                        New code
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="flex-1 min-h-[40px] rounded-lg border border-[var(--line)] text-xs"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(t.id)}
                      className="w-full min-h-[40px] rounded-lg border border-[var(--line)] text-xs text-muted flex items-center justify-center gap-1"
                    >
                      <RotateCcw size={12} /> Replace code
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <p className="px-4 md:px-8 mt-4 text-sm text-amber-700 print:hidden">
          Replacing a code stops the sticker currently on that table from working. Reprint it before
          the next service. · Mã cũ sẽ ngừng hoạt động — cần in lại.
        </p>
      )}
    </div>
  );
}

export default function StickersPage() {
  return (
    <RoleGate module="orders">
      <StickersContent />
    </RoleGate>
  );
}
