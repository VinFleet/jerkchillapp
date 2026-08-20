"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, BellRing, BellOff, Send, Check } from "lucide-react";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/RoleContext";
import {
  PUSH_CATEGORIES,
  PUSH_CATEGORY_LABEL,
  PUSH_CATEGORY_HINT,
  DEFAULT_PUSH_CATEGORIES,
  type PushCategory,
} from "@/lib/push/categories";
import {
  enablePush,
  disablePush,
  updateCategories,
  readPushState,
  readLocalCategories,
  saveCategoriesLocally,
  pushConfigured,
  sendTestPush,
  type PushState,
} from "@/lib/push/client";

/**
 * Where each person chooses what the app is allowed to interrupt them about.
 *
 * Open to everyone, not just the manager. Someone who is told about things
 * that aren't their job stops reading the alerts entirely, and then misses the
 * one that mattered — so the choice belongs to the person carrying the phone.
 */
export default function NotificationSettingsPage() {
  const router = useRouter();
  const { session } = useSession();
  const [state, setState] = useState<PushState | null>(null);
  const [chosen, setChosen] = useState<PushCategory[]>(DEFAULT_PUSH_CATEGORIES);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Read the saved choices first and synchronously. They live in
    // localStorage and must render immediately — waiting on the service worker
    // to answer meant a slow or absent worker left the screen showing defaults,
    // which reads as "my settings didn't save".
    setChosen(readLocalCategories());
    void readPushState().then(setState);
  }, []);

  const staff = { id: session?.activeStaffId ?? null, name: session?.name ?? "" };
  const subscribed = state?.supported === true && state.subscribed;

  const toggle = async (category: PushCategory) => {
    const next = chosen.includes(category)
      ? chosen.filter((c) => c !== category)
      : [...chosen, category];
    setChosen(next);
    // Saved straight away, whether or not alerts are on yet — otherwise
    // choosing first and enabling second silently loses the choices.
    saveCategoriesLocally(next);
    if (subscribed) await updateCategories(staff, next);
  };

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enablePush(staff, chosen);
    setBusy(false);
    if (result.ok) {
      setState(await readPushState());
      setMessage("Alerts are on for this phone. · Đã bật thông báo trên máy này.");
      return;
    }
    setMessage(
      {
        unsupported: "This browser can't do alerts. On iPhone, add the app to your Home Screen first. · Trình duyệt này không hỗ trợ. Trên iPhone, hãy thêm ứng dụng vào Màn hình chính trước.",
        not_configured: "Alerts aren't set up yet — ask the manager. · Chưa cài đặt thông báo — hỏi quản lý.",
        denied: "Your phone blocked alerts. Turn them on for this app in your phone's settings. · Điện thoại đã chặn. Hãy bật lại trong cài đặt máy.",
        failed: "Couldn't turn alerts on. Try again. · Không bật được. Thử lại.",
      }[result.reason]
    );
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setState(await readPushState());
    setBusy(false);
    setMessage("Alerts are off for this phone. · Đã tắt thông báo trên máy này.");
  };

  const test = async () => {
    setBusy(true);
    const ok = await sendTestPush();
    setBusy(false);
    setMessage(
      ok
        ? "Test sent — it should appear in a second. · Đã gửi thử — sẽ hiện sau một giây."
        : "Couldn't send the test. · Không gửi được."
    );
  };

  return (
    <div className="pb-6">
      <div className="px-4 md:px-8 pt-5">
        <button
          onClick={() => router.back()}
          className="min-h-11 flex items-center gap-1 text-sm text-brand font-semibold mb-2"
        >
          <ChevronLeft size={16} /> Back · Quay lại
        </button>
        <h1 className="text-xl font-bold">Alerts on this phone</h1>
        <p className="text-muted text-sm">Thông báo trên máy này</p>
      </div>

      <div className="px-4 md:px-8 mt-4 space-y-3">
        {!pushConfigured() && (
          <Card className="border-warning">
            <p className="text-sm font-semibold text-warning">Alerts aren&apos;t set up yet.</p>
            <p className="text-xs text-warning/80 mt-1">Chưa cài đặt thông báo.</p>
            <p className="text-xs text-muted mt-2">
              The owner needs to add the notification keys — see Part 7 of SETUP.md.
              <br />
              Chủ nhà hàng cần thêm khóa thông báo.
            </p>
          </Card>
        )}

        {state?.supported === false && (
          <Card className="border-warning">
            <p className="text-sm font-semibold text-warning">
              This browser can&apos;t show alerts.
            </p>
            <p className="text-xs text-muted mt-2">
              On iPhone, alerts only work once the app is added to the Home Screen — open the
              Share menu and tap &ldquo;Add to Home Screen&rdquo;, then open it from there.
              <br />
              Trên iPhone, cần thêm ứng dụng vào Màn hình chính trước.
            </p>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">
                {subscribed ? "Alerts are on" : "Alerts are off"}
              </p>
              <p className="text-xs text-muted">
                {subscribed ? "Đang bật thông báo" : "Đang tắt thông báo"}
              </p>
              {session?.name && (
                <p className="text-xs text-muted mt-1">
                  For {session.name} · Cho {session.name}
                </p>
              )}
            </div>
            {subscribed ? (
              <Button variant="secondary" className="min-h-11 text-sm shrink-0" disabled={busy} onClick={turnOff}>
                <BellOff size={15} className="mr-1.5" /> Turn off · Tắt
              </Button>
            ) : (
              <Button className="min-h-11 text-sm shrink-0" disabled={busy || !pushConfigured()} onClick={turnOn}>
                <BellRing size={15} className="mr-1.5" /> Turn on · Bật
              </Button>
            )}
          </div>

          {subscribed && (
            <button
              onClick={test}
              disabled={busy}
              className="min-h-11 mt-3 flex items-center gap-1.5 text-sm text-brand font-semibold"
            >
              <Send size={14} /> Send me a test · Gửi thử cho tôi
            </button>
          )}

          {message && <p className="text-sm text-muted mt-3 leading-snug">{message}</p>}
        </Card>

        <Card>
          <p className="font-semibold text-sm mb-1">Tell me about</p>
          <p className="text-xs text-muted mb-3">Thông báo cho tôi về</p>

          <div className="space-y-2">
            {PUSH_CATEGORIES.map((category) => {
              const on = chosen.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => toggle(category)}
                  className={`w-full min-h-16 rounded-2xl border-2 px-4 py-3 flex items-start gap-3 text-left ${
                    on ? "border-brand bg-brand-light" : "border-border"
                  }`}
                >
                  <span
                    className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                      on ? "border-brand bg-brand text-white" : "border-border"
                    }`}
                  >
                    {on && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-sm">
                      <Bi value={PUSH_CATEGORY_LABEL[category]} mode="inline" />
                    </span>
                    <span className="block text-xs text-muted mt-0.5">
                      {PUSH_CATEGORY_HINT[category].en}
                    </span>
                    <span className="block text-xs text-muted">
                      {PUSH_CATEGORY_HINT[category].vi}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted mt-3 leading-snug">
            These are your choices on this phone. Another person signing in on their own phone
            picks their own.
            <br />
            Đây là lựa chọn của bạn trên máy này. Người khác chọn riêng trên máy của họ.
          </p>
        </Card>
      </div>
    </div>
  );
}
