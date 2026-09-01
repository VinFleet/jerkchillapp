"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Building2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { setActiveTenant } from "@/lib/storage";
import { VinposWordmark } from "@/components/VinposWordmark";
import { slugify } from "@/lib/admin/auth";

/**
 * The front door for a restaurant we have never met.
 *
 * One page, three facts: the restaurant, its first location, the owner's
 * login. The database's create_organization function does the rest in one
 * transaction, because a half-created restaurant is a support ticket. The
 * device then points itself at the new branch and lands on a freshly seeded
 * app — the same first-run every branch gets.
 */

export default function SignupPage() {
  const [form, setForm] = useState({
    restaurant: "",
    branch: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const submit = async () => {
    if (!supabase) {
      setProblem("Not connected — try again in a moment.");
      return;
    }
    setBusy(true);
    setProblem(null);

    // The login first. If the email is taken nothing else has happened yet.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
    if (signUpError) {
      setBusy(false);
      setProblem(signUpError.message);
      return;
    }
    if (!signUpData.session) {
      // Email confirmation is on in Supabase: the org can only be created
      // once they are signed in. Tell them plainly rather than half-creating.
      setBusy(false);
      setNeedsConfirm(true);
      return;
    }

    const orgSlug = slugify(form.restaurant);
    const branchSlug = `${orgSlug}-${slugify(form.branch)}`.slice(0, 60);
    const { error: orgError } = await supabase.rpc("create_organization", {
      org_name: form.restaurant.trim(),
      org_slug: orgSlug,
      branch_name: form.branch.trim(),
      branch_slug: branchSlug,
    });
    setBusy(false);
    if (orgError) {
      setProblem(
        orgError.message.includes("duplicate")
          ? "That restaurant name is taken — try a variation."
          : orgError.message
      );
      return;
    }

    setActiveTenant(branchSlug);
    // Full reload on purpose: the app boots against the active tenant, and
    // this device just changed restaurants.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  };

  return (
    <div className="min-h-dvh bg-background grid place-items-center p-5">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <VinposWordmark size="lg" />
          <p className="text-sm text-muted">
            Start your restaurant · Bắt đầu nhà hàng của bạn
          </p>
        </div>

        {needsConfirm ? (
          <div className="rounded-2xl border border-border bg-surface p-5 text-center space-y-2">
            <Check size={32} className="text-success mx-auto" />
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-muted">
              Confirm the address, then come back here and sign up again — your login will be
              remembered and the restaurant will be created.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Building2 size={15} className="text-brand" /> Restaurant name · Tên nhà hàng
              </span>
              <input
                value={form.restaurant}
                onChange={(e) => setForm({ ...form, restaurant: e.target.value })}
                placeholder="Bánh Mì Bà Ba"
                className="w-full min-h-[52px] rounded-xl border border-border px-4"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">First location · Chi nhánh đầu</span>
              <input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="District 1 · Quận 1"
                className="w-full min-h-[52px] rounded-xl border border-border px-4"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Your email · Email của bạn</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                inputMode="email"
                autoComplete="email"
                className="w-full min-h-[52px] rounded-xl border border-border px-4"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Password (8+) · Mật khẩu</span>
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                type="password"
                autoComplete="new-password"
                className="w-full min-h-[52px] rounded-xl border border-border px-4"
              />
            </label>

            {problem && <p className="text-sm text-warning">{problem}</p>}

            <button
              onClick={() => void submit()}
              disabled={
                busy ||
                !form.restaurant.trim() ||
                !form.branch.trim() ||
                !form.email.trim() ||
                form.password.length < 8
              }
              className="w-full min-h-[52px] rounded-xl bg-brand text-white font-semibold disabled:bg-border disabled:text-muted flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Create my restaurant · Tạo nhà hàng
            </button>
          </div>
        )}

        <p className="text-center text-sm text-muted">
          Already using VINPOS?{" "}
          <Link href="/login" className="text-brand font-semibold">
            Sign in · Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
