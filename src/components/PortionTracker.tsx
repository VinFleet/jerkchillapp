"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChefHat, ChevronRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/RoleContext";
import { todayIso } from "@/lib/storage";
import { getStockItems, getOrCreateEntry, updateEntry } from "@/lib/repo/stock";
import { suggestQuantity } from "@/lib/repo/planner";
import {
  analysePortions,
  currentPhase,
  type PortionPhase,
} from "@/lib/repo/portionTrackerRules";
import type { StockItem } from "@/lib/types";

/**
 * Portions ready, counted at opening and at closing.
 *
 * The two numbers already existed in the stock log; what was missing was a
 * reason to enter them and an answer once you had. Counting at both ends tells
 * a chef what actually went out today and therefore how many to make for
 * tomorrow — which is the only reason anyone counts portions.
 *
 * It appears at opening and at closing and is silent through service, because
 * a card asking for a closing count at 2pm is how a closing figure ends up in
 * the opening box.
 */
type Row = {
  item: StockItem;
  opening: number;
  produced: number;
  closing: number | null;
  suggested: number | null;
};

function vietnamHour(now: Date): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        hour12: false,
      }).format(now)
    ) % 24
  );
}

export function PortionTracker() {
  const { session } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<PortionPhase>("idle");

  const load = useCallback(() => {
    if (!session) return;
    const date = todayIso();
    // Kitchen prep items only — the bar counts differently and a chef showed
    // twenty bottles of rum stops reading the card.
    const items = getStockItems("kitchen").filter((i) => i.prepCategory);
    setPhase(currentPhase(vietnamHour(new Date())));
    setRows(
      items.map((item) => {
        const entry = getOrCreateEntry(item.id, date, session.name);
        const suggested = suggestQuantity(item.id, date);
        return {
          item,
          opening: entry.opening,
          produced: entry.produced,
          closing: entry.closing,
          suggested: suggested > 0 ? suggested : null,
        };
      })
    );
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session || rows.length === 0) return null;
  // Kitchen work. FOH counting mains would be noise they can't action.
  if (session.role === "bartender") return null;

  const save = (itemId: string, field: "opening" | "produced" | "closing", value: string) => {
    const parsed = value === "" ? null : Math.max(0, Math.round(Number(value)));
    if (value !== "" && Number.isNaN(parsed)) return;
    updateEntry(itemId, todayIso(), { [field]: field === "closing" ? parsed : parsed ?? 0 }, session.name);
    load();
  };

  const heading =
    phase === "closing"
      ? { en: "Count what's left", vi: "Đếm phần còn lại" }
      : phase === "opening"
        ? { en: "Portions ready now", vi: "Số phần sẵn có" }
        : { en: "Portions today", vi: "Số phần hôm nay" };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {heading.en} · {heading.vi}
        </p>
        <Link href="/stock" className="text-xs font-semibold text-brand flex items-center gap-0.5">
          Full log · Sổ đầy đủ <ChevronRight size={13} />
        </Link>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ChefHat size={18} className="text-brand shrink-0" />
          <p className="text-xs text-muted">
            {phase === "closing"
              ? "What's left at close tells you how many to make tomorrow."
              : "Count what's ready, and add to it as you prep."}
            <br />
            {phase === "closing"
              ? "Phần còn lại cuối ngày cho biết mai cần làm bao nhiêu."
              : "Đếm phần sẵn có, cộng thêm khi chuẩn bị."}
          </p>
        </div>

        <div className="space-y-3">
          {rows.map((row) => {
            const insight = analysePortions({
              itemId: row.item.id,
              opening: row.opening,
              produced: row.produced,
              closing: row.closing,
              suggested: row.suggested,
            });

            return (
              <div key={row.item.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                <p className="font-semibold text-sm">{row.item.name.en}</p>
                <p className="text-xs text-muted mb-2">{row.item.name.vi}</p>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 min-w-[5.5rem]">
                    <span className="block text-[11px] text-muted mb-0.5">Ready · Sẵn có</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={row.opening}
                      onChange={(e) => save(row.item.id, "opening", e.target.value)}
                      className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-lg tabular-nums text-center"
                    />
                  </label>
                  <label className="flex-1 min-w-[5.5rem]">
                    <span className="block text-[11px] text-muted mb-0.5">Made · Đã làm</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={row.produced}
                      onChange={(e) => save(row.item.id, "produced", e.target.value)}
                      className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-lg tabular-nums text-center"
                    />
                  </label>
                  <label className="flex-1 min-w-[5.5rem]">
                    <span className="block text-[11px] text-muted mb-0.5">Left · Còn lại</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={row.closing ?? ""}
                      placeholder="—"
                      onChange={(e) => save(row.item.id, "closing", e.target.value)}
                      className={`w-full min-h-12 rounded-xl border-2 px-3 text-lg tabular-nums text-center ${
                        phase === "closing" && row.closing === null
                          ? "border-warning bg-warning-tint"
                          : "border-border"
                      }`}
                    />
                  </label>
                </div>

                {insight.impossible ? (
                  <p className="text-xs text-danger font-semibold mt-1.5 flex items-start gap-1">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>
                      More left than were ever made — check the count.
                      <br />
                      Còn nhiều hơn số đã làm — kiểm tra lại.
                    </span>
                  </p>
                ) : insight.usedToday !== null ? (
                  <p className="text-xs mt-1.5">
                    <span className="text-muted">
                      {insight.usedToday} went out · đã bán {insight.usedToday}
                    </span>
                    {insight.toPrep !== null && (
                      <span className="font-bold text-brand">
                        {" — make "}
                        {insight.toPrep}
                        {" tomorrow · mai làm "}
                        {insight.toPrep}
                      </span>
                    )}
                  </p>
                ) : insight.toPrep !== null ? (
                  <p className="text-xs text-muted mt-1.5">
                    Usually about {insight.toPrep} a day · thường khoảng {insight.toPrep}/ngày
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
