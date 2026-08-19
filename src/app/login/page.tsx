"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/RoleContext";
import { ROLE_LABEL, ROLE_ORDER } from "@/lib/roleLabels";
import type { Role } from "@/lib/types";
import { Bi } from "@/components/Bi";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");

  const handleStart = () => {
    if (!role || !name.trim()) return;
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
                onClick={() => setRole(null)}
                className="text-sm text-brand font-semibold mb-4"
              >
                &larr; Back / Quay lại
              </button>
              <h1 className="text-center font-bold text-lg mb-1">
                <Bi value={ROLE_LABEL[role]} className="items-center" mode="inline" />
              </h1>
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
        </div>
      </div>
    </div>
  );
}
