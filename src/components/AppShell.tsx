"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MoreHorizontal, Settings } from "lucide-react";
import { NAV_ITEMS, MOBILE_PRIMARY_MODULES } from "@/lib/nav";
import { canAccessModule } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/RoleContext";
import { ROLE_LABEL } from "@/lib/roleLabels";
import { Bi } from "@/components/Bi";
import { StorageFullBanner } from "@/components/StorageFullBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useSession();

  if (!session) return null;

  const items = NAV_ITEMS.filter(
    (item) => item.module === "home" || canAccessModule(session.role, item.module)
  );
  const mobileItems = items.filter(
    (item) => item.module === "home" || MOBILE_PRIMARY_MODULES.includes(item.module)
  );
  const moreItems = items.filter(
    (item) => item.module !== "home" && !MOBILE_PRIMARY_MODULES.includes(item.module)
  );
  const moreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname === "/more";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-surface print:hidden">
        <div className="p-5 flex items-center gap-3">
          <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={140} height={99} priority />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  active ? "bg-brand text-white" : "text-foreground hover:bg-brand-light"
                }`}
              >
                <Icon size={22} />
                <Bi value={item.label} className="text-sm leading-tight" />
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-sm font-semibold">{session.name}</div>
          <div className="text-xs text-muted mb-3">
            <Bi value={ROLE_LABEL[session.role]} mode="inline" />
          </div>
          {session.role === "owner" && (
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
        <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={100} height={71} priority />
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
      </header>

      <main className="flex-1 pb-24 md:pb-8 print:pb-0">
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
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
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
