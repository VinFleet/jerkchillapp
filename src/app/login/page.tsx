"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VinposWordmark } from "@/components/VinposWordmark";
import { useRouter } from "next/navigation";
import { ChefHat, Wine, ShieldCheck, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useSession, STATION_LABEL } from "@/lib/auth/RoleContext";
import { deviceIsSignedIn, checkManagerAccess, type ManagerCheck } from "@/lib/auth/stationAuth";
import type { Station } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase/client";

/**
 * The device signs in to a station, not a person.
 *
 * Four chefs share the pass tablet and cannot be signing in and out through a
 * service, so the login below happens once — when the manager sets the device
 * up — and never again. Who did what is recorded by picking a name inside the
 * app instead. A device that is already signed in skips straight past this
 * screen to the station picker.
 *
 * The manager station is the exception in one more way: it shows wages and
 * cost margins, so it additionally checks the signed-in account actually
 * carries an owner or manager role in the database.
 */
const STATIONS: { station: Station; icon: typeof ChefHat; blurb: { en: string; vi: string } }[] = [
  { station: "kitchen", icon: ChefHat, blurb: { en: "The pass tablet — recipes, prep, food safety", vi: "Máy tính bảng bếp — công thức, chuẩn bị, an toàn TP" } },
  { station: "foh", icon: Wine, blurb: { en: "Bar and service — bookings, bar stock, complaints", vi: "Quầy bar và phục vụ — đặt bàn, tồn kho bar, khiếu nại" } },
  { station: "manager", icon: ShieldCheck, blurb: { en: "Everything, including costs and wages", vi: "Toàn quyền, gồm chi phí và lương" } },
];

export default function LoginPage() {
  const { signInStation } = useSession();
  const router = useRouter();
  const [chosen, setChosen] = useState<Station | null>(null);
  const [deviceReady, setDeviceReady] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [managerBlock, setManagerBlock] = useState<ManagerCheck | null>(null);

  useEffect(() => {
    void deviceIsSignedIn().then(setDeviceReady);
  }, []);

  const enter = (station: Station) => {
    signInStation(station);
    router.replace("/home");
  };

  /** Manager needs the extra role check; the other two just need the device signed in. */
  const proceed = async (station: Station) => {
    if (station !== "manager") {
      enter(station);
      return;
    }
    setBusy(true);
    const check = await checkManagerAccess();
    setBusy(false);
    if (check.ok) enter("manager");
    else setManagerBlock(check);
  };

  const start = (station: Station) => {
    setChosen(station);
    setAuthError(null);
    setManagerBlock(null);
    if (deviceReady) void proceed(station);
  };

  const signIn = async () => {
    if (!chosen || !email.trim() || !password) return;
    if (!supabase) {
      setAuthError("Not connected yet — finish the Supabase setup first. · Chưa kết nối — hoàn tất cài đặt Supabase.");
      return;
    }
    setBusy(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setAuthError("Incorrect email or password · Sai email hoặc mật khẩu");
      return;
    }
    setPassword("");
    setDeviceReady(true);
    setBusy(false);
    await proceed(chosen);
  };

  const back = () => {
    setChosen(null);
    setAuthError(null);
    setManagerBlock(null);
    setPassword("");
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 safe-top safe-bottom"
      style={{
        backgroundColor: "var(--brand)",
        backgroundImage: "url('/brand/pattern-800.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "260px",
      }}
    >
      <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-xl">
        <div className="flex justify-center mb-5">
          <span className="flex flex-col items-center gap-1"><VinposWordmark size="lg" /><span className="text-xs text-muted">Restaurant point of sale · Máy tính tiền nhà hàng</span></span>
        </div>

        {!chosen ? (
          <>
            <h1 className="text-center font-bold text-lg">Where are you working?</h1>
            <p className="text-center text-sm text-muted mb-5">Bạn đang làm ở đâu?</p>

            <div className="space-y-3">
              {STATIONS.map(({ station, icon: Icon, blurb }) => (
                <button
                  key={station}
                  onClick={() => start(station)}
                  className="w-full min-h-16 rounded-2xl border-2 border-border px-4 py-3 flex items-center gap-3 text-left active:bg-brand-light"
                >
                  <Icon size={22} className="text-brand shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-sm">{STATION_LABEL[station].en}</span>
                    <span className="block text-xs text-muted">{STATION_LABEL[station].vi}</span>
                    <span className="block text-[11px] text-muted mt-0.5">{blurb.en}</span>
                    <span className="block text-[11px] text-muted">{blurb.vi}</span>
                  </span>
                </button>
              ))}
            </div>

            {deviceReady && (
              <p className="text-[11px] text-success text-center mt-4 flex items-center justify-center gap-1 font-semibold">
                <CheckCircle2 size={13} /> Device already set up · Thiết bị đã cài đặt
              </p>
            )}
            <p className="text-[11px] text-muted text-center mt-2 leading-snug">
              You&apos;ll pick your name inside — no need to sign in and out during a shift.
              <br />
              Bạn sẽ chọn tên bên trong — không cần đăng nhập/đăng xuất liên tục trong ca.
            </p>
        <p className="text-center text-xs text-muted mt-4">
          New restaurant?{" "}
          <Link href="/signup" className="text-brand font-semibold">
            Start on VINPOS · Bắt đầu
          </Link>
        </p>
          </>
        ) : (
          <>
            <button onClick={back} className="min-h-11 flex items-center gap-1 text-sm text-brand font-semibold mb-2">
              <ChevronLeft size={16} /> Back · Quay lại
            </button>
            <h1 className="font-bold text-lg">{STATION_LABEL[chosen].en}</h1>
            <p className="text-sm text-muted mb-4">{STATION_LABEL[chosen].vi}</p>

            {managerBlock && !managerBlock.ok ? (
              <ManagerBlocked check={managerBlock} />
            ) : (
              <>
                <div className="rounded-2xl bg-brand-light p-3 mb-4">
                  <p className="text-xs font-semibold text-brand">Set this device up — once only</p>
                  <p className="text-xs text-brand/80">Cài đặt thiết bị này — chỉ một lần</p>
                  <p className="text-[11px] text-brand/80 mt-1.5 leading-snug">
                    The manager enters this when the tablet is first set up. Staff never see it again.
                    <br />
                    Quản lý nhập khi cài máy lần đầu. Nhân viên không cần nhập lại.
                  </p>
                </div>

                <input
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                  placeholder="Password · Mật khẩu"
                  className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
                />
                {authError && <p className="text-sm text-danger font-semibold mb-2">{authError}</p>}
                <Button className="w-full" disabled={!email.trim() || !password || busy} onClick={signIn}>
                  {busy ? "Signing in… · Đang đăng nhập…" : "Sign in · Đăng nhập"}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Refusing manager access is only useful if it says what to do next — the
 * owner hitting this at 6pm needs the fix, not a policy statement.
 */
function ManagerBlocked({ check }: { check: Extract<ManagerCheck, { ok: false }> }) {
  if (check.reason === "not-a-manager") {
    return (
      <div className="rounded-2xl border-2 border-danger p-3">
        <p className="text-sm font-semibold text-danger">This account isn&apos;t a manager or owner.</p>
        <p className="text-xs text-danger/80 mt-1">Tài khoản này không phải quản lý hoặc chủ.</p>
        <p className="text-xs text-muted mt-2">
          Use the Kitchen or Front of house station instead.
          <br />
          Hãy dùng khu vực Bếp hoặc Phục vụ.
        </p>
      </div>
    );
  }
  if (check.reason === "no-role-row") {
    return (
      <div className="rounded-2xl border-2 border-warning p-3">
        <p className="text-sm font-semibold text-warning">This account has no role assigned yet.</p>
        <p className="text-xs text-warning/80 mt-1">Tài khoản này chưa được gán vai trò.</p>
        <p className="text-xs text-muted mt-2 mb-2">
          Run this once in the Supabase SQL editor, then try again:
        </p>
        <pre className="text-[10px] bg-background rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
{`insert into staff_roles (user_id, role, full_name)
values ('${check.userId}', 'owner', 'Owner');`}
        </pre>
      </div>
    );
  }
  if (check.reason === "table-missing") {
    return (
      <div className="rounded-2xl border-2 border-warning p-3">
        <p className="text-sm font-semibold text-warning">Roles aren&apos;t set up in the database yet.</p>
        <p className="text-xs text-warning/80 mt-1">Chưa cài đặt vai trò trong cơ sở dữ liệu.</p>
        <p className="text-xs text-muted mt-2">
          Run <span className="font-mono">supabase/schema.sql</span> in the Supabase SQL editor — it creates the
          <span className="font-mono"> staff_roles</span> table — then come back here.
          <br />
          Chạy tệp đó trong Supabase, rồi quay lại.
        </p>
      </div>
    );
  }
  if (check.reason === "lookup-failed") {
    return (
      <div className="rounded-2xl border-2 border-danger p-3">
        <p className="text-sm font-semibold text-danger">Couldn&apos;t check your role.</p>
        <p className="text-xs text-danger/80 mt-1">Không kiểm tra được vai trò.</p>
        <p className="text-xs text-muted mt-2 font-mono break-words">{check.detail}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border-2 border-danger p-3">
      <p className="text-sm font-semibold text-danger">Not signed in · Chưa đăng nhập</p>
    </div>
  );
}
