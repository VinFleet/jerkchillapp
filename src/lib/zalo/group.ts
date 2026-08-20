import { unwrapZaloResponse, ZaloError } from "./errors";
import { getValidAccessToken } from "./tokens";
import { getZaloConfig } from "./config";
import { escapeMentions } from "./mentions";

export { escapeMentions };

/**
 * Posting into the staff's Zalo group.
 *
 * This is the cheapest channel Zalo offers: group messages carry no per-message
 * charge, no send quota, and no seven-day interaction window. For a fixed
 * cohort of seven people getting the same operational notices, nothing else
 * comes close.
 *
 * The constraint that shapes everything: the group must have been created by
 * the Official Account. There is no join-an-existing-group API, so the team's
 * current Zalo group cannot be written into — they have to move to one the OA
 * made. That is a one-off migration, not a recurring cost, but it is the part
 * that needs a human decision rather than code.
 */

const OA_HOST = "https://openapi.zalo.me";

export type GroupSendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "skipped"; reason: "not_configured" }
  | { status: "failed"; code: number; message: string; retryable: boolean };

export type GroupMessageInput = {
  /** Written by us. Not escaped, so our own mentions still work. */
  headline: string;
  /**
   * Anything that came from a guest, a supplier, or a free-text field.
   * Escaped before sending.
   */
  untrustedBody?: string;
  /** Ping everyone. Uses the group id, per Zalo's convention. */
  mentionEveryone?: boolean;
};

/**
 * Send one message to the OA-owned staff group.
 *
 * Like every other outbound path in this app, expected failures come back as
 * values rather than exceptions — a notification that doesn't send must never
 * break the action that triggered it.
 */
export async function sendGroupMessage(input: GroupMessageInput): Promise<GroupSendResult> {
  const cfg = getZaloConfig();
  const groupId = process.env.ZALO_GROUP_ID;
  if (!cfg || !groupId) return { status: "skipped", reason: "not_configured" };

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

  const parts: string[] = [];
  if (input.mentionEveryone) parts.push(`[@${groupId}]`);
  parts.push(input.headline);
  if (input.untrustedBody) parts.push(escapeMentions(input.untrustedBody));

  try {
    const res = await fetch(`${OA_HOST}/v3.0/oa/group/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Bare header, as everywhere else in Zalo's API.
        access_token: accessToken,
      },
      body: JSON.stringify({
        recipient: { group_id: groupId },
        message: { text: parts.join("\n") },
      }),
    });

    const json = await res.json();
    const data = unwrapZaloResponse<{ message_id?: string }>(json);
    return { status: "sent", messageId: data?.message_id ?? null };
  } catch (err) {
    if (err instanceof ZaloError) {
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
