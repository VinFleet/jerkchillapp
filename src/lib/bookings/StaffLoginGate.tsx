"use client";

import { useState } from "react";
import Image from "next/image";
import { useStaffAuth } from "@/lib/bookings/StaffAuthContext";
import { supabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function NotConfiguredNotice() {
  return (
    <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
      <p className="font-semibold">Booking isn&apos;t connected yet</p>
      <p className="text-muted text-sm max-w-sm">
        Booking chưa được kết nối. Ask the owner to finish the Supabase setup (see supabase/schema.sql and .env.local.example in the project).
      </p>
    </div>
  );
}

function StaffLoginForm() {
  const { signIn } = useStaffAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 safe-top safe-bottom"
      style={{
        backgroundColor: "var(--brand)",
        backgroundImage: "url('/brand/pattern-800.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "220px",
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex justify-center mb-6">
            <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={200} height={142} priority />
          </div>
          <h1 className="text-center font-bold text-lg mb-1">Set this device up</h1>
          <p className="text-center text-muted text-sm mb-6">Cài đặt thiết bị này</p>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base mb-3 focus:outline-none focus:border-brand"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Password"
            className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base mb-4 focus:outline-none focus:border-brand"
          />
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <Button className="w-full" disabled={!email.trim() || !password || loading} onClick={submit}>
            {loading ? "Signing in…" : "Sign in / Đăng nhập"}
          </Button>
          <p className="text-center text-muted text-xs mt-4">
            The station login for this device — the manager enters it once. It covers
            bookings and everything else the tablet shares.
            <br />
            Mật khẩu thiết bị — quản lý nhập một lần, dùng cho toàn bộ ứng dụng.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Bookings used to hold the only Supabase login in the app, so it carried its
 * own sign-in form and its own sign-out button. Station sign-in now provides
 * that session for the whole device, so in normal use this gate simply passes
 * through — the form is left in place only as the fallback for a device that
 * somehow reaches this page without one.
 *
 * The sign-out button is deliberately gone. It used to log out of bookings;
 * the same tap now ends the session every module syncs through, so a bartender
 * tidying up after service could quietly cut the tablet off from the rest of
 * the restaurant. Ending a session is a station-level decision, and it lives
 * with the station controls in the sidebar.
 */
export function StaffLoginGate({ children }: { children: React.ReactNode }) {
  const { session, ready } = useStaffAuth();

  if (!supabaseConfigured) return <NotConfiguredNotice />;
  if (!ready) return null;
  if (!session) return <StaffLoginForm />;

  return <>{children}</>;
}
