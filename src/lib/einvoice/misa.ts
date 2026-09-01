import type { EInvoiceProvider, EInvoiceRequest, EInvoiceIssueResult } from "./types";

/**
 * MISA meInvoice driver — a skeleton with the seams in the right places.
 *
 * Deliberately NOT implemented from memory: MISA's API (endpoints, auth
 * handshake, payload field names) must come from their current integration
 * documentation and a sandbox account, or this would be confidently wrong in
 * the one place a wrong field is a tax problem. What is fixed here is the
 * contract: config comes from the server environment (credentials are
 * secrets — never synced, never in a table members can read), issue() is
 * idempotent per orderId on the provider side via their reference field, and
 * failures distinguish retryable (network, throttle) from terminal (rejected
 * payload).
 *
 * To finish this driver you need from MISA:
 *  - a meInvoice service account (appId + license) for the seller's tax code
 *  - the invoice template/serial (mẫu số / ký hiệu) registered with the tax
 *    authority for this business
 *  - their current REST endpoint base + token exchange flow
 * Wire those through EINVOICE_MISA_* env vars, then replace the stub in
 * issue() with the real calls. docs/EINVOICE.md tracks the full plan.
 */

export function misaProvider(): EInvoiceProvider {
  const appId = process.env.EINVOICE_MISA_APP_ID;
  const license = process.env.EINVOICE_MISA_LICENSE;
  const endpoint = process.env.EINVOICE_MISA_ENDPOINT;

  return {
    id: "misa",
    configured() {
      return Boolean(appId && license && endpoint);
    },
    async issue(request: EInvoiceRequest): Promise<EInvoiceIssueResult> {
      if (!this.configured()) {
        return {
          ok: false,
          error: "MISA credentials not configured (EINVOICE_MISA_APP_ID / _LICENSE / _ENDPOINT)",
          retryable: false,
        };
      }
      // TODO(misa): token exchange, then POST the invoice payload built from
      // `request`, mapping our fields to MISA's schema per their docs.
      // Until then this driver refuses rather than pretends.
      void request;
      return {
        ok: false,
        error: "MISA driver not implemented yet — integration pending sandbox access",
        retryable: false,
      };
    },
  };
}
