"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileDown, BookOpenCheck } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import { visibleFoodSafetyLogs } from "@/lib/auth/permissions";
import { FOOD_SAFETY_LOG_LABEL, FOOD_SAFETY_LOG_ICON, FOOD_SAFETY_LOG_ORDER } from "@/lib/foodSafetyLabels";
import {
  getOutOfRangeCount,
  getCleaningTasks,
  getSignoffsForDate,
  getOverdueSamples,
  getOpenPestCount,
  getInspectionsForDate,
  getCookLogs,
  cookDate,
  getDeliveryLogs,
  getComplaints,
} from "@/lib/repo/foodSafety";
import { todayIso } from "@/lib/storage";
import type { FoodSafetyLogType } from "@/lib/types";

function useSummaries() {
  const [summaries, setSummaries] = useState<Partial<Record<FoodSafetyLogType, { text: string; tone: "success" | "warning" | "danger" | "muted" }>>>({});

  useEffect(() => {
    const date = todayIso();
    const outOfRange = getOutOfRangeCount(date);
    const cleaningTotal = getCleaningTasks().length;
    // Withdrawn sign-offs stay in the record for the audit trail, but they
    // aren't done — counting them would show a clean day that isn't.
    const cleaningDone = getSignoffsForDate(date).filter((s) => !s.revokedAt).length;
    const overdueSamples = getOverdueSamples().length;
    const openPest = getOpenPestCount();
    const inspectionsToday = getInspectionsForDate(date).length;
    // cookDate() reads the day the batch was actually cooked (so a backdated
    // entry counts against the right day) and resolves it in local time —
    // slicing the ISO timestamp gives the UTC day, which in Vietnam is still
    // yesterday until 07:00.
    const cookToday = getCookLogs(500).filter((c) => cookDate(c) === date).length;
    const deliveriesToday = getDeliveryLogs(500).filter((d) => d.date === date).length;
    const openComplaints = getComplaints().filter((c) => !c.outcome).length;

    setSummaries({
      temperature: outOfRange > 0
        ? { text: `${outOfRange} out of range today`, tone: "danger" }
        : { text: "All in range today", tone: "success" },
      cooking: { text: `${cookToday} logged today`, tone: "muted" },
      deliveries: { text: `${deliveriesToday} logged today`, tone: "muted" },
      cleaning: {
        text: `${cleaningDone}/${cleaningTotal} signed off today`,
        tone: cleaningTotal > 0 && cleaningDone === cleaningTotal ? "success" : "muted",
      },
      inspections: { text: `${inspectionsToday} checks logged today`, tone: "muted" },
      samples: overdueSamples > 0
        ? { text: `${overdueSamples} past 24h — discard`, tone: "warning" }
        : { text: "Up to date", tone: "success" },
      pest: openPest > 0 ? { text: `${openPest} open`, tone: "warning" } : { text: "No open issues", tone: "success" },
      complaints: openComplaints > 0
        ? { text: `${openComplaints} awaiting outcome`, tone: "warning" }
        : { text: "All resolved", tone: "success" },
    });
  }, []);

  return summaries;
}

function FoodSafetyContent() {
  const { session } = useSession();
  const summaries = useSummaries();
  if (!session) return null;

  const visible = FOOD_SAFETY_LOG_ORDER.filter((t) => visibleFoodSafetyLogs(session.role).includes(t));

  return (
    <div className="pb-6">
      <PageHeader
        title="Food Safety · An Toàn Thực Phẩm"
        subtitle="Timestamped, tamper-evident, inspector-ready · Có dấu thời gian, không thể chỉnh sửa ngầm"
      />
      <div className="px-4 md:px-8 space-y-2">
        <Link href="/food-safety/reference">
          <Card className="flex items-center gap-3 border-brand/30 active:bg-brand-light transition-colors mb-2">
            <span className="shrink-0 w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center">
              <BookOpenCheck size={20} />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-sm">Reference Rules · Quy Tắc Tham Khảo</p>
              <p className="text-xs text-muted">Hygiene, handwashing, cross-contamination, allergies</p>
            </div>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </Card>
        </Link>

        {visible.map((type) => {
          const Icon = FOOD_SAFETY_LOG_ICON[type];
          const summary = summaries[type];
          return (
            <Link key={type} href={`/food-safety/${type}`}>
              <Card className="flex items-center gap-3 active:bg-brand-light transition-colors">
                <span className="shrink-0 w-11 h-11 rounded-xl bg-brand-light text-brand flex items-center justify-center">
                  <Icon size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <Bi value={FOOD_SAFETY_LOG_LABEL[type]} className="font-semibold text-sm" />
                  {summary && (
                    <span className="mt-1 inline-block">
                      <Badge tone={summary.tone}>{summary.text}</Badge>
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="text-muted shrink-0" />
              </Card>
            </Link>
          );
        })}

        {(session.role === "owner" || session.role === "manager") && (
          <Link href="/food-safety/export">
            <Card className="flex items-center gap-3 border-brand/30 active:bg-brand-light transition-colors mt-4">
              <FileDown size={20} className="text-brand shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Export for inspection · Xuất hồ sơ kiểm tra</p>
                <p className="text-xs text-muted">Print or save as PDF · In hoặc lưu PDF</p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function FoodSafetyPage() {
  return (
    <RoleGate module="foodSafety">
      <FoodSafetyContent />
    </RoleGate>
  );
}
