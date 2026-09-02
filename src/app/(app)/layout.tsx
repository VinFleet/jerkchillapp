"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/RoleContext";
import { AppShell } from "@/components/AppShell";
import { SyncProvider } from "@/lib/sync/SyncProvider";
import { ensureAllSeeded } from "@/lib/seed/bootstrap";
import { startTillPrintWorker } from "@/lib/print/tillWorker";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  useEffect(() => {
    ensureAllSeeded();
  }, []);

  // On the native till this starts the queue claimer (guest-QR orders, other
  // devices' sends); on the web it is a no-op. Gated on session so a signed-
  // out webview never polls.
  useEffect(() => {
    if (!session) return;
    return startTillPrintWorker();
  }, [session]);

  if (!ready || !session) {
    // A skeleton rather than a bare word: this is the first thing anyone sees
    // when the tablet wakes up, and a blank screen with one line of text reads
    // as "broken" for the second it's there.
    return (
      <div className="min-h-dvh p-4 md:p-8" aria-busy="true" aria-label="Loading · Đang tải">
        <div className="animate-pulse space-y-3 max-w-2xl">
          <div className="h-6 w-40 rounded-lg bg-black/10 dark:bg-white/10" />
          <div className="h-4 w-56 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-24 rounded-2xl bg-black/10 dark:bg-white/10 mt-6" />
          <div className="h-24 rounded-2xl bg-black/10 dark:bg-white/10" />
          <div className="h-24 rounded-2xl bg-black/10 dark:bg-white/10" />
        </div>
        <span className="sr-only">Loading · Đang tải</span>
      </div>
    );
  }

  // Sync starts only once a session exists and seeding has run, so a fresh
  // device never pushes an empty collection over the shared copy.
  return (
    <SyncProvider>
      <AppShell>{children}</AppShell>
    </SyncProvider>
  );
}
