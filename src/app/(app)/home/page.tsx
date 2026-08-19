"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/RoleContext";
import { canAccessModule } from "@/lib/auth/permissions";
import { NAV_ITEMS } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roleLabels";
import { getCompletion } from "@/lib/repo/checklists";
import { getNotices, isAckedBy } from "@/lib/repo/notices";
import { getReorderFlags } from "@/lib/repo/planner";
import { getOutOfRangeCount, getOverdueSamples, getOpenPestCount } from "@/lib/repo/foodSafety";
import { getLicensesNeedingAttention } from "@/lib/repo/licensing";
import { getReprintFlag } from "@/lib/repo/menu";
import { getExpiringHealthCerts, getExpiringTraining } from "@/lib/repo/staff";
import { getShoppingList } from "@/lib/repo/shopping";
import { getBlockersCount } from "@/lib/repo/deliveryPerformance";
import { getBookingsForDate } from "@/lib/bookings/repo";
import { supabaseConfigured } from "@/lib/supabase/client";
import { todayIso } from "@/lib/storage";
import type { ChecklistArea, ChecklistShift, Notice } from "@/lib/types";

function currentShift(): ChecklistShift {
  const hour = new Date().getHours();
  return hour < 16 ? "opening" : "closing";
}

function primaryAreaForRole(role: string): ChecklistArea {
  return role === "bartender" ? "foh" : "kitchen";
}

export default function HomePage() {
  const { session } = useSession();
  const [checklist, setChecklist] = useState<{ done: number; total: number } | null>(null);
  const [shift, setShift] = useState<ChecklistShift>("opening");
  const [unread, setUnread] = useState<Notice[]>([]);
  const [reorderCount, setReorderCount] = useState(0);
  const [foodSafetyIssues, setFoodSafetyIssues] = useState(0);
  const [licensesNeeding, setLicensesNeeding] = useState(0);
  const [reprintNeeded, setReprintNeeded] = useState(false);
  const [healthCertsExpiring, setHealthCertsExpiring] = useState(0);
  const [trainingDue, setTrainingDue] = useState(0);
  const [shoppingListCount, setShoppingListCount] = useState(0);
  const [deliveryBlockers, setDeliveryBlockers] = useState(0);
  const [bookingsToday, setBookingsToday] = useState(0);

  useEffect(() => {
    if (!session) return;
    const s = currentShift();
    const area = primaryAreaForRole(session.role);
    setShift(s);
    setChecklist(getCompletion(area, s, todayIso()));
    setUnread(getNotices().filter((n) => !isAckedBy(n.id, session.name)));
    if (session.role === "owner" || session.role === "manager" || session.role === "chef") {
      setReorderCount(getReorderFlags(todayIso()).length);
      setFoodSafetyIssues(
        getOutOfRangeCount(todayIso()) + getOverdueSamples().length + getOpenPestCount()
      );
    }
    if ((session.role === "owner" || session.role === "manager" || session.role === "bartender") && supabaseConfigured) {
      getBookingsForDate(todayIso())
        .then((rows) => setBookingsToday(rows.filter((b) => b.status === "confirmed" || b.status === "seated").length))
        .catch(() => setBookingsToday(0));
    }
    if (session.role === "owner" || session.role === "manager") {
      setLicensesNeeding(getLicensesNeedingAttention().length);
      setReprintNeeded(getReprintFlag());
      setHealthCertsExpiring(getExpiringHealthCerts().length);
      setTrainingDue(getExpiringTraining().length);
      setShoppingListCount(getShoppingList().length);
      setDeliveryBlockers(getBlockersCount("grab") + getBlockersCount("shopeefood"));
    }
  }, [session]);

  if (!session) return null;

  const modules = NAV_ITEMS.filter(
    (item) => item.module !== "home" && canAccessModule(session.role, item.module)
  );
  const urgentUnread = unread.filter((n) => n.priority === "urgent");
  const checklistDone = checklist && checklist.total > 0 && checklist.done === checklist.total;

  return (
    <div className="pb-6">
      <div className="px-4 md:px-8 pt-5 pb-2">
        <p className="text-muted text-sm">
          Hi {session.name} ·{" "}
          <Bi value={ROLE_LABEL[session.role]} mode="inline" className="inline" />
        </p>
        <h1 className="text-xl font-bold">What do I need to do right now?</h1>
        <p className="text-muted text-sm">Tôi cần làm gì bây giờ?</p>
      </div>

      <div className="px-4 md:px-8 mt-3 space-y-3">
        {urgentUnread.length > 0 && (
          <Link href="/notices">
            <Card className="border-danger/40 bg-danger-tint flex items-center gap-3">
              <AlertCircle size={22} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-danger">
                  {urgentUnread.length} urgent notice{urgentUnread.length > 1 ? "s" : ""} · thông báo khẩn
                </p>
                <p className="text-sm truncate text-danger/80">{urgentUnread[0].title.en}</p>
              </div>
              <ChevronRight size={18} className="text-danger shrink-0" />
            </Card>
          </Link>
        )}

        {checklist && (
          <Link href="/checklists">
            <Card className={checklistDone ? "border-success/40 bg-success-tint" : "border-brand/30"}>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">
                {shift === "opening" ? "Opening checklist · Danh sách mở cửa" : "Closing checklist · Danh sách đóng cửa"}
              </p>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${checklistDone ? "text-success" : "text-brand"}`}>
                  {checklist.done}/{checklist.total}
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-brand">
                  {checklistDone ? "All done · Hoàn tất" : "Continue · Tiếp tục"}
                  <ChevronRight size={18} />
                </span>
              </div>
            </Card>
          </Link>
        )}

        {bookingsToday > 0 && (
          <Link href="/bookings">
            <Card className="border-brand/30 flex items-center justify-between">
              <p className="text-sm font-semibold text-brand">
                {bookingsToday} booking{bookingsToday > 1 ? "s" : ""} today · đặt bàn hôm nay
              </p>
              <ChevronRight size={18} className="text-brand shrink-0" />
            </Card>
          </Link>
        )}

        {reorderCount > 0 && (
          <Link href="/planner">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">
                {reorderCount} bar item{reorderCount > 1 ? "s" : ""} below par · dưới định mức
              </p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}

        {foodSafetyIssues > 0 && (
          <Link href="/food-safety">
            <Card className="border-danger/40 bg-danger-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-danger">
                {foodSafetyIssues} food safety item{foodSafetyIssues > 1 ? "s" : ""} need attention · cần chú ý
              </p>
              <ChevronRight size={18} className="text-danger shrink-0" />
            </Card>
          </Link>
        )}

        {licensesNeeding > 0 && (
          <Link href="/licensing">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">
                {licensesNeeding} licence{licensesNeeding > 1 ? "s" : ""} need attention · cần chú ý
              </p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}

        {reprintNeeded && (
          <Link href="/menu">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">Menu reprint needed · Cần in lại menu</p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}

        {healthCertsExpiring > 0 && (
          <Link href="/staff">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">
                {healthCertsExpiring} health cert{healthCertsExpiring > 1 ? "s" : ""} expiring soon · sắp hết hạn
              </p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}

        {trainingDue > 0 && (
          <Link href="/staff">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">
                {trainingDue} training refresher{trainingDue > 1 ? "s" : ""} due · cần đào tạo lại
              </p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}

        {shoppingListCount > 0 && (
          <Link href="/shopping">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">
                {shoppingListCount} item{shoppingListCount > 1 ? "s" : ""} to order · cần đặt hàng
              </p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}

        {deliveryBlockers > 0 && (
          <Link href="/delivery-performance">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <p className="text-sm font-semibold text-warning">
                {deliveryBlockers} delivery badge requirement{deliveryBlockers > 1 ? "s" : ""} unmet · chưa đạt
              </p>
              <ChevronRight size={18} className="text-warning shrink-0" />
            </Card>
          </Link>
        )}
      </div>

      <div className="px-4 md:px-8 mt-6">
        <h2 className="font-bold text-sm text-muted uppercase tracking-wide mb-2">
          Modules · Chức năng
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="min-h-24 bg-surface border border-border rounded-2xl p-4 flex flex-col items-start justify-between active:bg-brand-light transition-colors"
              >
                <Icon size={24} className="text-brand" />
                <Bi value={m.label} className="text-sm font-semibold mt-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
