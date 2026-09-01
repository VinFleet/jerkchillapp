"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, MoreHorizontal, Settings } from "lucide-react";
import { NAV_ITEMS, mobilePrimaryModules, ordersHref, LAUNCH_GROUPS, launchOrder } from "@/lib/nav";
import { getReceiptSettings } from "@/lib/repo/receiptSettings";
import { VinposWordmark } from "@/components/VinposWordmark";
import { canAccessModule } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/RoleContext";
import { useSync } from "@/lib/sync/SyncProvider";
import { getNavBadges, type NavBadges } from "@/lib/notify/badges";
import { STATION_LABEL } from "@/lib/auth/RoleContext";
import { Bi } from "@/components/Bi";
import { StorageFullBanner } from "@/components/StorageFullBanner";
import { SyncIndicator } from "@/components/SyncIndicator";
import { UrgentNoticeBanner } from "@/components/UrgentNoticeBanner";
import { WhoIsWorking } from "@/components/WhoIsWorking";


/**
 * The chrome wears the restaurant's identity, not ours.
 *
 * Jerk & Chill is customer number one and sees its own logo exactly as
 * before; a new branch shows its own name the moment the owner types it, and
 * the product mark only until then. VINPOS is the platform, not the sign
 * over anyone's door.
 */
function TenantBrand({ compact = false }: { compact?: boolean }) {
  const [brand, setBrand] = useState<{ name: string; logoUrl?: string } | null>(null);
  useEffect(() => {
    const r = getReceiptSettings();
    setBrand({ name: r.headerName, logoUrl: r.logoUrl });
  }, []);
  if (!brand) return <VinposWordmark />;
  if (brand.logoUrl) {
    return (
      <Image
        src={brand.logoUrl}
        alt={brand.name || "logo"}
        width={compact ? 100 : 140}
        height={compact ? 71 : 99}
        priority
        className="shrink-0 w-auto"
        style={{ maxHeight: compact ? 44 : 64 }}
      />
    );
  }
  if (brand.name) {
    return <span className="font-black text-lg tracking-tight truncate">{brand.name}</span>;
  }
  return <VinposWordmark />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useSession();
  const { dataVersion } = useSync();
  const [badges, setBadges] = useState<NavBadges>({});

  // Recomputed when synced data lands, so a notice posted on another device
  // shows up on this one's nav without anyone reloading.
  useEffect(() => {
    if (session) setBadges(getNavBadges(session.role, session.name));
  }, [session, dataVersion, pathname]);

  if (!session) return null;

  const items = NAV_ITEMS.filter(
    (item) => item.module === "home" || canAccessModule(session.role, item.module)
  );
  const primary = mobilePrimaryModules(session.station);
  const mobileItems = items.filter(
    (item) =>
      item.module === "home" ||
      (primary.includes(item.module) &&
        // orders appears twice in NAV_ITEMS (Service and Kitchen Pass); the
        // bar has room for the one this station actually stands at.
        (item.module !== "orders" || item.href === ordersHref(session.station)))
  );
  const moreItems = items.filter(
    (item) => item.module !== "home" && !mobileItems.includes(item)
  );
  const moreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname === "/more";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-surface print:hidden">
        <div className="p-5 flex items-center gap-3">
          <TenantBrand />
        </div>
        {/* Grouped like a back office rather than a flat module list — the
            same section headings the launcher uses, so the phone and the
            desktop teach the same map of the app. */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4">
          <Link
            href="/home"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              pathname === "/home" ? "bg-brand text-white" : "text-foreground hover:bg-brand-light"
            }`}
          >
            <Home size={20} />
            <span className="text-sm leading-tight flex-1">Home · Trang chủ</span>
          </Link>
          {launchOrder(session.station).flatMap((groupId) => {
            const group = LAUNCH_GROUPS.find((g) => g.id === groupId)!;
            const visible = group.items.filter(
              (item) => item.module === "home" || canAccessModule(session.role, item.module)
            );
            if (visible.length === 0) return [];
            return [
              <p
                key={`${group.id}-title`}
                className="text-[11px] font-bold uppercase tracking-wide text-muted px-4 pt-4 pb-1"
              >
                {group.title.en} · {group.title.vi}
              </p>,
              ...visible.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                      active ? "bg-brand text-white" : "text-foreground hover:bg-brand-light"
                    }`}
                  >
                    <Icon size={20} />
                    <Bi value={item.label} className="text-sm leading-tight flex-1" />
                    {badges[item.module] ? (
                      <span className={`min-w-6 h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${active ? "bg-white text-brand" : "bg-danger text-white"}`}>
                        {badges[item.module]}
                      </span>
                    ) : null}
                  </Link>
                );
              }),
            ];
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <SyncIndicator className="mb-2" />
          <div className="text-xs text-muted mb-2">
            <Bi value={STATION_LABEL[session.station]} mode="inline" />
          </div>
          <div className="mb-3">
            <WhoIsWorking />
          </div>
          {(session.role === "owner" || session.role === "manager") && (
            <Link href="/settings" className="flex items-center gap-2 text-sm text-foreground font-semibold mb-3">
              <Settings size={16} /> Settings / Cài đặt
            </Link>
          )}
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex items-center gap-2 text-sm text-danger font-semibold"
          >
            <LogOut size={16} /> Log out / Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden print:hidden safe-top sticky top-0 z-20 bg-surface border-b border-border flex items-center justify-between px-4 py-2">
        <TenantBrand compact />
        <div className="flex items-center gap-2 min-w-0">
          <WhoIsWorking compact />
          <SyncIndicator className="shrink-0 whitespace-nowrap" />
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex flex-col items-center text-brand"
            aria-label="Log out / Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8 print:pb-0">
        <UrgentNoticeBanner />
        <StorageFullBanner />
        {children}
      </main>

      {/* Mobile bottom nav — Home + a few primaries, everything else behind More */}
      <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border safe-bottom">
        <div className="flex">
          {mobileItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-16 py-2 ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  {badges[item.module] ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                      {badges[item.module]}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-medium leading-tight">{item.label.en}</span>
              </Link>
            );
          })}
          {moreItems.length > 0 && (
            <Link
              href="/more"
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-16 py-2 ${
                moreActive ? "text-brand" : "text-muted"
              }`}
            >
              <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-tight">More</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
