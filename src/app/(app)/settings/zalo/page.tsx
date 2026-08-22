"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, CheckCircle2, XCircle, RefreshCw, Link2, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth/RoleContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Zalo connection status, in plain language.
 *
 * Half of Zalo's platform is gated on three flags the console does not put in
 * one place — verified, package tier, and whether a Cloud Account is linked.
 * This asks Zalo directly and says what each answer means, so "why won't it
 * send?" is answered before a service rather than during one.
 */

type Capability = { available: boolean; blockedBy: string[] };
type Status =
  | { status: "not_configured" }
  | { status: "no_token_store" }
  | { status: "not_connected" }
  | { status: "error"; code: number; message: string; needsAttention: boolean }
  | {
      status: "ok";
      info: {
        name: string;
        isVerified: boolean;
        packageName: string | null;
        packageValidThrough: string | null;
        linkedZca: boolean;
        followers: number | null;
      };
      capabilities: { groupMessaging: Capability; bookingConfirmations: Capability };
    };

function CapabilityRow({ title, vi, capability }: { title: string; vi: string; capability: Capability }) {
  return (
    <div className="py-3 border-t border-border first:border-t-0">
      <div className="flex items-start gap-2">
        {capability.available ? (
          <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
        ) : (
          <XCircle size={18} className="text-danger shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted">{vi}</p>
          {capability.available ? (
            <p className="text-xs text-success font-semibold mt-1">Ready · Sẵn sàng</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {capability.blockedBy.map((reason) => (
                <li key={reason} className="text-xs text-danger">
                  — {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ZaloSettingsContent() {
  const router = useRouter();
  const { session } = useSession();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const justConnected = params.get("connected");
  const failureReason = params.get("reason");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zalo/status");
      setStatus((await res.json()) as Status);
    } catch {
      setStatus({ status: "error", code: -1, message: "Couldn't reach the server", needsAttention: false });
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (!session) return null;
  if (session.role !== "owner") {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <ShieldAlert size={40} className="text-muted" />
        <p className="font-semibold">Not available for your role</p>
        <p className="text-muted text-sm">Không khả dụng cho vai trò của bạn</p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="px-4 md:px-8 pt-5">
        <button
          onClick={() => router.back()}
          className="min-h-11 flex items-center gap-1 text-sm text-brand font-semibold mb-2"
        >
          <ChevronLeft size={16} /> Back · Quay lại
        </button>
        <h1 className="text-xl font-bold">Zalo connection</h1>
        <p className="text-muted text-sm">Kết nối Zalo</p>
      </div>

      <div className="px-4 md:px-8 mt-4 space-y-3">
        {justConnected === "1" && (
          <Card className="border-success">
            <p className="text-sm font-semibold text-success">Official Account connected.</p>
            <p className="text-xs text-muted mt-1">Đã kết nối Official Account.</p>
          </Card>
        )}
        {justConnected === "0" && (
          <Card className="border-danger">
            <p className="text-sm font-semibold text-danger">Couldn&apos;t connect.</p>
            <p className="text-xs text-muted mt-1">
              {
                {
                  not_configured: "The Zalo keys aren't set — see Part 6 of SETUP.md.",
                  no_code: "Zalo didn't send an authorisation code back.",
                  expired: "It took longer than 10 minutes — start again.",
                  wrong_oa: "That's a different Official Account from the one configured here.",
                  no_oa_id: "Zalo didn't say which Official Account was approved. Set ZALO_OA_ID and try again.",
                  exchange_failed: "Zalo rejected the code. Check the App ID and secret, and that ZALO_PKCE_VERIFIER matches the Code Challenge saved in the console.",
                  no_consent_url: "ZALO_CONSENT_URL isn't set. Zalo generates the consent link in the console — copy it into that variable.",
                  no_verifier: "ZALO_PKCE_VERIFIER isn't set. It must be the verifier whose challenge is saved in the Zalo console.",
                }[failureReason ?? ""] ?? "Try again."
              }
            </p>
          </Card>
        )}

        {loading && (
          <Card>
            <p className="text-sm text-muted flex items-center gap-2">
              <RefreshCw size={15} className="animate-spin" /> Checking with Zalo… · Đang kiểm tra…
            </p>
          </Card>
        )}

        {!loading && status?.status === "not_configured" && (
          <Card className="border-warning">
            <p className="text-sm font-semibold text-warning">Zalo isn&apos;t set up yet.</p>
            <p className="text-xs text-muted mt-2">
              Add the App ID, secret and OA ID first — Part 6 of SETUP.md.
              <br />
              Cần thêm App ID, secret và OA ID trước.
            </p>
          </Card>
        )}

        {!loading && status?.status === "no_token_store" && (
          <Card className="border-warning">
            <p className="text-sm font-semibold text-warning">
              Zalo keys are set, but the token store isn&apos;t reachable.
            </p>
            <p className="text-xs text-muted mt-2">
              Add <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> in Vercel and run{" "}
              <span className="font-mono">supabase/zalo-schema.sql</span>. Connecting won&apos;t work
              until both are done — there would be nowhere to keep the grant.
              <br />
              Cần thêm khóa Supabase và chạy tệp SQL trước khi kết nối.
            </p>
          </Card>
        )}

        {!loading && status?.status === "not_connected" && (
          <Card>
            <p className="font-semibold text-sm mb-1">Not connected yet</p>
            <p className="text-xs text-muted mb-3">
              Approve this app against your Official Account. You only do this once.
              <br />
              Chỉ cần cấp quyền một lần.
            </p>
            <Button
              onClick={() => {
                // A full navigation, not router.push: this route answers with a
                // redirect to Zalo's consent screen, and a client-side
                // navigation cannot follow one off-site.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/api/zalo/connect";
              }}
            >
              <Link2 size={15} className="mr-1.5" /> Connect Zalo · Kết nối Zalo
            </Button>
          </Card>
        )}

        {!loading && status?.status === "error" && (
          <Card className="border-danger">
            <p className="text-sm font-semibold text-danger">Zalo returned an error ({status.code})</p>
            <p className="text-xs text-muted mt-1">{status.message}</p>
            {status.needsAttention && (
              <p className="text-xs text-danger font-semibold mt-2">
                This needs fixing in the Zalo console — retrying won&apos;t help.
              </p>
            )}
          </Card>
        )}

        {!loading && status?.status === "ok" && (
          <>
            <Card>
              <p className="font-semibold text-sm">{status.info.name || "Official Account"}</p>
              <div className="mt-2 space-y-1 text-xs">
                <p className={status.info.isVerified ? "text-success font-semibold" : "text-danger font-semibold"}>
                  {status.info.isVerified ? "✓ Verified · Đã xác minh" : "✗ Not verified · Chưa xác minh"}
                </p>
                <p className="text-muted">
                  Package · Gói: <span className="font-semibold">{status.info.packageName ?? "unknown"}</span>
                  {status.info.packageValidThrough && ` — until ${status.info.packageValidThrough}`}
                </p>
                <p className={status.info.linkedZca ? "text-success" : "text-muted"}>
                  {status.info.linkedZca
                    ? "✓ Zalo Cloud Account linked"
                    : "Zalo Cloud Account not linked — needed to pay for guest messages"}
                </p>
                {status.info.followers !== null && (
                  <p className="text-muted">
                    Followers · Người quan tâm: <span className="font-semibold">{status.info.followers}</span>
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <p className="font-semibold text-sm mb-1">What this account can do</p>
              <p className="text-xs text-muted mb-2">Tài khoản này làm được gì</p>
              <CapabilityRow
                title="Post alerts to the staff group"
                vi="Gửi thông báo vào nhóm nhân viên"
                capability={status.capabilities.groupMessaging}
              />
              <CapabilityRow
                title="Send guests a booking confirmation"
                vi="Gửi xác nhận đặt bàn cho khách"
                capability={status.capabilities.bookingConfirmations}
              />
            </Card>
          </>
        )}

        {!loading && (
          <button
            onClick={() => void load()}
            className="min-h-11 flex items-center gap-1.5 text-sm text-brand font-semibold"
          >
            <RefreshCw size={14} /> Check again · Kiểm tra lại
          </button>
        )}
      </div>
    </div>
  );
}

export default function ZaloSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ZaloSettingsContent />
    </Suspense>
  );
}
