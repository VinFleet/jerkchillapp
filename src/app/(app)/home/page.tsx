"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, ClipboardCheck } from "lucide-react";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/RoleContext";
import { canAccessModule } from "@/lib/auth/permissions";
import { NAV_ITEMS } from "@/lib/nav";
import { STATION_LABEL } from "@/lib/auth/RoleContext";
import { getDueToday, type DueTask } from "@/lib/repo/dueToday";
import { LAUNCH_GROUPS, launchOrder } from "@/lib/nav";
import { cashUpForDate } from "@/lib/repo/orders";
import { PortionTracker } from "@/components/PortionTracker";
import { GettingStarted } from "@/components/GettingStarted";
import { getCompletion } from "@/lib/repo/checklists";
import { getNotices, isAckedBy } from "@/lib/repo/notices";
import { getReorderFlags } from "@/lib/repo/planner";
import { getOutOfRangeCount, getOverdueSamples, getOpenPestCount } from "@/lib/repo/foodSafety";
import { getLicensesNeedingAttention } from "@/lib/repo/licensing";
import { getReprintFlag } from "@/lib/repo/menu";
import { getExpiringHealthCerts, getExpiringTraining } from "@/lib/repo/staff";
import { getShoppingList } from "@/lib/repo/shopping";
import { getEntry as getSalesEntry } from "@/lib/repo/sales";
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
  const [salesMissing, setSalesMissing] = useState(false);
  const [due, setDue] = useState<DueTask[]>([]);
  const [till, setTill] = useState<ReturnType<typeof cashUpForDate> | null>(null);

  useEffect(() => {
    if (!session) return;
    const s = currentShift();
    const area = primaryAreaForRole(session.role);
    setShift(s);
    setChecklist(getCompletion(area, s, todayIso()));
    setUnread(getNotices().filter((n) => !isAckedBy(n.id, session.name)));
    setDue(getDueToday(session.role));
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
      setTill(cashUpForDate(todayIso()));
      setLicensesNeeding(getLicensesNeedingAttention().length);
      setReprintNeeded(getReprintFlag());
      setHealthCertsExpiring(getExpiringHealthCerts().length);
      setTrainingDue(getExpiringTraining().length);
      setShoppingListCount(getShoppingList().length);
      setDeliveryBlockers(getBlockersCount("grab") + getBlockersCount("shopeefood"));
      // Every other daily task nudges from here; end-of-day takings didn't,
      // which is exactly the one it's easiest to walk out without doing.
      // Only after close, so it isn't nagging through service.
      const sales = getSalesEntry(todayIso());
      const takingsEntered = Boolean(
        sales && Object.values(sales.channelAmountsVnd).some((amount) => amount > 0)
      );
      setSalesMissing(new Date().getHours() >= 21 && !takingsEntered);
    }
  }, [session]);

  if (!session) return null;

  const modules = NAV_ITEMS.filter(
    (item) => item.module !== "home" && canAccessModule(session.role, item.module)
  );
  const urgentUnread = unread.filter((n) => n.priority === "urgent");
  const normalUnread = unread.filter((n) => n.priority !== "urgent");
  const checklistDone = checklist && checklist.total > 0 && checklist.done === checklist.total;

  return (
    <div className="pb-6">
      <div className="px-4 md:px-8 pt-5 pb-2">
        <p className="text-muted text-sm">
          {session.name ? `Hi ${session.name} · ` : ""}
          <Bi value={STATION_LABEL[session.station]} mode="inline" className="inline" />
        </p>
        <h1 className="text-xl font-bold">What do I need to do right now?</h1>
        <p className="text-muted text-sm">Tôi cần làm gì bây giờ?</p>
      </div>

      <div className="px-4 md:px-8 mt-3 space-y-3">
        {/* A fresh branch's first hour — renders only while setup is unfinished,
            and only for the roles that can finish it. */}
        {(session.role === "owner" || session.role === "manager") && <GettingStarted />}

        {/* The checks you still owe, before anything else on the screen.
            Everything below this reports a *problem* — an out-of-range reading,
            an overdue sample. A check nobody has done yet is not a problem
            anywhere: it is a gap in a legally-required record that surfaces
            weeks later, at an inspection. So it goes first, and it goes at the
            top. */}
        {due.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">
              To do now · Cần làm ngay
            </p>
            <div className="space-y-2">
              {due.map((task) => (
                <Link key={task.id} href={task.href}>
                  <Card
                    className={`flex items-center gap-3 ${
                      task.urgency === 0 ? "border-danger bg-danger-tint" : "border-warning bg-warning-tint"
                    }`}
                  >
                    <ClipboardCheck
                      size={22}
                      className={`shrink-0 ${task.urgency === 0 ? "text-danger" : "text-warning"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${task.urgency === 0 ? "text-danger" : "text-warning"}`}>
                        {task.label.en}
                      </p>
                      <p className={`text-sm ${task.urgency === 0 ? "text-danger/80" : "text-warning/80"}`}>
                        {task.label.vi}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {task.detail.en} · {task.detail.vi}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`shrink-0 ${task.urgency === 0 ? "text-danger" : "text-warning"}`}
                    />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sapo's own overview opens with today's money, and the habit is
            right: an owner glancing at their phone wants the number before
            the navigation. Live from the till, tap through for the detail. */}
        {till && (till.totalVnd > 0 || till.stillOpenCount > 0) && (
          <Link href="/sales">
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Today from the till · Hôm nay</p>
                <p className="text-xl font-black tabular-nums">
                  {till.totalVnd.toLocaleString("vi-VN")}₫
                </p>
                <p className="text-xs text-muted">
                  {till.orderCount} closed · đơn
                  {till.stillOpenCount > 0 && (
                    <span className="text-warning font-semibold">
                      {" "}· {till.stillOpenCount} open · đang mở
                    </span>
                  )}
                  {till.discountVnd > 0 && ` · −${till.discountVnd.toLocaleString("vi-VN")}₫ giảm`}
                </p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </Card>
          </Link>
        )}

        {/* The launcher. Four or five answers to "why am I here", as tiles a
            new hire can read on day one — grouped by the job, ordered by the
            station, and showing only what this role can open. */}
        {launchOrder(session.station).map((groupId) => {
          const group = LAUNCH_GROUPS.find((g) => g.id === groupId)!;
          const visible = group.items.filter((item) =>
            canAccessModule(session.role, item.module as Exclude<typeof item.module, "home">)
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.id}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2 mt-1">
                {group.title.en} · {group.title.vi}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {visible.map((item) => {
                  const Icon = item.icon;
                  const badge =
                    item.href === "/notices" && unread.length > 0
                      ? unread.length
                      : item.href === "/bookings" && bookingsToday > 0
                        ? bookingsToday
                        : item.href === "/shopping" && shoppingListCount > 0
                          ? shoppingListCount
                          : null;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative min-h-[76px] rounded-2xl border border-border bg-surface p-3 flex flex-col justify-between active:scale-[0.98]"
                    >
                      <Icon size={20} className="text-brand" />
                      <span>
                        <span className="block text-sm font-semibold leading-tight">
                          {item.label.en}
                        </span>
                        <span className="block text-xs text-muted">{item.label.vi}</span>
                      </span>
                      {badge !== null && (
                        <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-danger text-white text-xs font-bold grid place-items-center">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Counting portions at both ends is what tells a chef how many to make
            tomorrow. It sits under the compliance checks but above the status
            cards: it is work to do, not a number to read. */}
        <PortionTracker />

        {/* Normal notices used to surface nowhere — "we're out of X" and "new
            supplier price" are the spec's own examples of what replaces the
            group chat, and they were invisible unless someone thought to open
            the Notices tab. Urgent ones also interrupt via the banner; this is
            the quieter half. */}
        {normalUnread.length > 0 && (
          <Link href="/notices">
            <Card className="border-brand/40 bg-brand-light flex items-center gap-3">
              <AlertCircle size={22} className="text-brand shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-brand">
                  {normalUnread.length} unread notice{normalUnread.length > 1 ? "s" : ""} · thông báo chưa đọc
                </p>
                <p className="text-sm truncate text-brand/80">
                  {normalUnread[0].title.en} · {normalUnread[0].title.vi}
                </p>
              </div>
              <ChevronRight size={18} className="text-brand shrink-0" />
            </Card>
          </Link>
        )}

        {urgentUnread.length > 0 && (
          <Link href="/notices">
            <Card className="border-danger/40 bg-danger-tint flex items-center gap-3">
              <AlertCircle size={22} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-danger">
                  {urgentUnread.length} urgent notice{urgentUnread.length > 1 ? "s" : ""} · thông báo khẩn
                </p>
                <p className="text-sm truncate text-danger/80">{urgentUnread[0].title.en} · {urgentUnread[0].title.vi}</p>
              </div>
              <ChevronRight size={18} className="text-danger shrink-0" />
            </Card>
          </Link>
        )}

        {salesMissing && (
          <Link href="/sales">
            <Card className="border-warning/40 bg-warning-tint flex items-center justify-between">
              <div>
                <p className="font-bold text-warning">Today&apos;s takings not entered yet</p>
                <p className="text-sm text-warning/80">Chưa nhập doanh thu hôm nay</p>
              </div>
              <ChevronRight size={18} className="text-warning shrink-0" />
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
                {/* Not just bar any more — this now covers kitchen ingredients
                    too, so the old "bar items" wording was actively wrong. */}
                {reorderCount} item{reorderCount > 1 ? "s" : ""} below par · mặt hàng dưới định mức
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
