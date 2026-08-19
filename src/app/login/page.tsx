"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/RoleContext";
import { ROLE_LABEL, ROLE_ORDER } from "@/lib/roleLabels";
import type { Role } from "@/lib/types";
import { Bi } from "@/components/Bi";
import { Button } from "@/components/ui/Button";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  // Owner is the one role backed by a real login — anyone can tap
  // Manager/Chef/Bartender and type their name (same as always, and it's
  // still what gets logged on everything they do), but Owner sees wages and
  // cost/margin data, so that one needs a password check against Supabase.
  const [ownerVerified, setOwnerVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const needsOwnerAuth = role === "owner" && !ownerVerified;

  const handleOwnerSignIn = async () => {
    if (!email.trim() || !password) return;
    if (!supabase) {
      setAuthError("Owner login isn't connected yet — finish the Supabase setup first.");
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSigningIn(false);
    if (error) {
      setAuthError("Incorrect email or password.");
      return;
    }
    setOwnerVerified(true);
  };

  const handleStart = () => {
    if (!role || !name.trim()) return;
    if (role === "owner" && !ownerVerified) return;
    login({ role, name: name.trim() });
    router.replace("/home");
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
            <Image src="/brand/logo-600.png" alt="Jerk & Chill" width={220} height={156} priority />
          </div>

          {!role ? (
            <>
              <h1 className="text-center font-bold text-lg mb-1">
                Who&apos;s working today?
              </h1>
              <p className="text-center text-muted text-sm mb-6">Ai đang làm việc hôm nay?</p>
              <div className="grid grid-cols-1 gap-3">
                {ROLE_ORDER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className="min-h-16 rounded-2xl border-2 border-brand-tint bg-brand-light active:bg-brand-tint px-5 flex items-center justify-between text-left transition-colors"
                  >
                    <Bi value={ROLE_LABEL[r]} className="text-brand font-semibold" />
                    <span className="text-brand text-xl">&rarr;</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setRole(null);
                  setOwnerVerified(false);
                  setEmail("");
                  setPassword("");
                  setAuthError(null);
                }}
                className="text-sm text-brand font-semibold mb-4"
              >
                &larr; Back / Quay lại
              </button>
              <h1 className="text-center font-bold text-lg mb-1">
                <Bi value={ROLE_LABEL[role]} className="items-center" mode="inline" />
              </h1>
              {needsOwnerAuth ? (
                <>
                  <p className="text-center text-muted text-sm mb-6">
                    Owner login · Đăng nhập Chủ nhà hàng
                  </p>
                  <input
                    autoFocus
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base mb-3 focus:outline-none focus:border-brand"
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOwnerSignIn()}
                    placeholder="Password · Mật khẩu"
                    className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base mb-3 focus:outline-none focus:border-brand"
                  />
                  {authError && <p className="text-danger text-sm mb-3">{authError}</p>}
                  {!supabaseConfigured && (
                    <p className="text-muted text-xs mb-3">
                      Owner login isn&apos;t connected yet — finish the Supabase setup first.
                      <br />
                      Chưa kết nối đăng nhập Chủ — cần hoàn tất thiết lập Supabase trước.
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={!email.trim() || !password || signingIn}
                    onClick={handleOwnerSignIn}
                  >
                    {signingIn ? "Signing in…" : "Sign in · Đăng nhập"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-center text-muted text-sm mb-6">
                    What&apos;s your name? · Tên của bạn là gì?
                  </p>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStart()}
                    placeholder="e.g. Duc"
                    className="w-full min-h-14 rounded-2xl border-2 border-border px-4 text-base mb-4 focus:outline-none focus:border-brand"
                  />
                  <Button className="w-full" disabled={!name.trim()} onClick={handleStart}>
                    Start shift / Bắt đầu ca
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
