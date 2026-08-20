import { unwrapZaloResponse, ZaloError } from "./errors";
import { getValidAccessToken } from "./tokens";
import { getZaloConfig, serviceRoleConfigured } from "./config";
// The pure gating logic lives on its own so it is testable without a network.
import { assessCapabilities, type OaInfo, type OaCapabilities } from "./capabilities";

export type { OaInfo, OaCapabilities };

/**
 * The Official Account's own health check.
 *
 * `GET /v2.0/oa/getoa` is cheap, has no side effects, and reports the three
 * things that silently gate half the platform: whether the OA is verified,
 * which package it is on, and whether a Zalo Cloud Account is linked. Checking
 * them here means the answer to "why won't it send?" is a sentence on a screen
 * rather than a -221 / -224 / -136 discovered mid-service.
 */

const OA_HOST = "https://openapi.zalo.me";

export type OaStatus =
  | { status: "not_configured" }
  /** Zalo keys are present but the token store can't be reached at all. */
  | { status: "no_token_store" }
  | { status: "not_connected" }
  | { status: "error"; code: number; message: string; needsAttention: boolean }
  | { status: "ok"; info: OaInfo; capabilities: OaCapabilities };

/**
 * Read the OA's current state.
 *
 * Note the `data` query-parameter convention: OA GET endpoints take their
 * arguments as one JSON-encoded `data` param rather than ordinary query
 * parameters. ZBS endpoints do the opposite. They are genuinely different and
 * must not be unified.
 */
export async function getOaStatus(): Promise<OaStatus> {
  const cfg = getZaloConfig();
  if (!cfg) return { status: "not_configured" };
  // Checked before attempting a token read, so "we can't look" is never
  // reported as "there's nothing there" — they need different fixes, and
  // conflating them means clicking Connect and getting the same message back.
  if (!serviceRoleConfigured()) return { status: "no_token_store" };

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(cfg);
  } catch (err) {
    if (err instanceof ZaloError && err.code === -135) return { status: "not_connected" };
    if (err instanceof ZaloError) {
      return { status: "error", code: err.code, message: err.zaloMessage, needsAttention: err.needsAttention };
    }
    // A non-Zalo failure here is the store itself, not the grant.
    return { status: "no_token_store" };
  }

  try {
    const res = await fetch(`${OA_HOST}/v2.0/oa/getoa`, {
      headers: { access_token: accessToken },
    });
    const json = await res.json();
    const data = unwrapZaloResponse<{
      oaid?: string | number;
      name?: string;
      is_verified?: boolean | number;
      package_name?: string;
      package_valid_through_date?: string;
      linked_ZCA?: boolean | number;
      num_follower?: number;
    }>(json);

    const info: OaInfo = {
      // Zalo ids exceed 2^53 — they stay strings and are never parsed as numbers.
      oaid: String(data.oaid ?? ""),
      name: data.name ?? "",
      isVerified: Boolean(data.is_verified),
      packageName: data.package_name ?? null,
      packageValidThrough: data.package_valid_through_date ?? null,
      linkedZca: Boolean(data.linked_ZCA),
      followers: typeof data.num_follower === "number" ? data.num_follower : null,
    };

    return { status: "ok", info, capabilities: assessCapabilities(info) };
  } catch (err) {
    if (err instanceof ZaloError) {
      return { status: "error", code: err.code, message: err.zaloMessage, needsAttention: err.needsAttention };
    }
    return { status: "error", code: -1, message: String(err), needsAttention: false };
  }
}

