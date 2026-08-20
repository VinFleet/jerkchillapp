import { unwrapZaloResponse, ZaloError } from "./errors";
import { normalizeVnPhone } from "./phone";
import { isInNightBan, nextSendableTime } from "./sendWindow";
import { getValidAccessToken } from "./tokens";
import { getZaloConfig } from "./config";

/**
 * ZNS / ZBS template sending — the only way to reach a guest who has never
 * interacted with the restaurant's Official Account.
 *
 * Ordinary OA messages can only be sent to someone who messaged the OA in the
 * last seven days, which no restaurant guest has. Templates are addressed by
 * phone number instead, which is exactly what a booking gives us.
 */

/** Note this is a different host from the OA messaging API. */
const ZNS_HOST = "https://business.openapi.zalo.me";

export type ZnsSendResult =
  | { status: "sent"; messageId: string; remainingQuota: number | null }
  | { status: "skipped"; reason: "not_configured" | "invalid_phone" }
  | { status: "deferred"; retryAfter: Date; reason: "night_ban" }
  | { status: "failed"; code: number; message: string; retryable: boolean };

export type BookingConfirmationInput = {
  phone: string;
  guestName: string;
  /** Rendered for the guest, e.g. "19:30 20/08/2026". */
  bookingTime: string;
  partySize: number;
  /** Our own booking id — becomes the idempotency and correlation key. */
  bookingRef: string;
};

/**
 * `tracking_id` is capped at 48 characters and is the only way to match a
 * delivery receipt back to a booking, so it is derived from the booking rather
 * than random.
 */
function trackingIdFor(bookingRef: string): string {
  return `booking-${bookingRef}`.slice(0, 48);
}

/**
 * Send a booking confirmation.
 *
 * Never throws for an expected condition. Confirming a booking is a courtesy
 * that must not be able to fail the booking itself, so every outcome — no
 * credentials, a bad number, the night ban, a Zalo rejection — comes back as a
 * value the caller can log and move on from.
 */
export async function sendBookingConfirmation(
  input: BookingConfirmationInput,
  now: Date = new Date()
): Promise<ZnsSendResult> {
  const cfg = getZaloConfig();
  if (!cfg) return { status: "skipped", reason: "not_configured" };

  const phone = normalizeVnPhone(input.phone);
  if (!phone) return { status: "skipped", reason: "invalid_phone" };

  // Checked before the call rather than after the -133, so the queue doesn't
  // fill overnight with attempts that were never going to land.
  if (isInNightBan(now)) {
    return { status: "deferred", retryAfter: nextSendableTime(now), reason: "night_ban" };
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(cfg);
  } catch (err) {
    if (err instanceof ZaloError) {
      return {
        status: "failed",
        code: err.code,
        message: err.message,
        retryable: err.kind === "transient" || err.kind === "auth_refresh",
      };
    }
    return { status: "failed", code: -1, message: String(err), retryable: false };
  }

  const body: Record<string, unknown> = {
    phone,
    template_id: cfg.bookingTemplateId,
    template_data: {
      customer: input.guestName,
      time: input.bookingTime,
      guests: String(input.partySize),
    },
    tracking_id: trackingIdFor(input.bookingRef),
  };
  if (cfg.developmentMode) body.mode = "development";

  try {
    const res = await fetch(`${ZNS_HOST}/message/template`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A bare header. Not `Authorization: Bearer` — Zalo rejects that.
        access_token: accessToken,
      },
      body: JSON.stringify(body),
    });

    // Deliberately ignores res.status: Zalo answers 200 for failures too, and
    // the real verdict is the `error` field inside the envelope.
    const json = await res.json();
    const data = unwrapZaloResponse<{
      msg_id: string;
      quota?: { remainingQuota?: string };
    }>(json);

    return {
      status: "sent",
      messageId: data.msg_id,
      remainingQuota: data.quota?.remainingQuota ? Number(data.quota.remainingQuota) : null,
    };
  } catch (err) {
    if (err instanceof ZaloError) {
      if (err.isNightBan) {
        // Belt and braces: our clock said daytime, Zalo's disagreed.
        return { status: "deferred", retryAfter: nextSendableTime(now), reason: "night_ban" };
      }
      return {
        status: "failed",
        code: err.code,
        message: err.message,
        retryable: err.kind === "transient" || err.kind === "auth_refresh",
      };
    }
    return { status: "failed", code: -1, message: String(err), retryable: true };
  }
}
