"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/RoleContext";
import { AppShell } from "@/components/AppShell";
import { ensureAllSeeded } from "@/lib/seed/bootstrap";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  useEffect(() => {
    ensureAllSeeded();
  }, []);

  if (!ready || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted">
        Loading… / Đang tải…
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
