/**
 * E-invoicing (hoá đơn điện tử) — the shape of the thing, ahead of the wire.
 *
 * Vietnamese law (Decree 123/2020, amended by 70/2025) requires F&B
 * businesses above threshold to issue e-invoices from the point of sale,
 * connected to the tax authority through a licensed provider (MISA, Viettel,
 * VNPT, FPT…). This module is the adapter seam: everything the app needs to
 * SAY about an invoice, kept apart from any provider's API so the day the
 * credentials exist, only the driver changes.
 *
 * Pure and import-free on purpose — the VND/VAT arithmetic in here is
 * exactly the kind of thing that must be testable without a browser.
 */

export type EInvoiceLine = {
  name: string;
  qty: number;
  /** VAT-inclusive unit price, as menu prices are quoted in Vietnam. */
  unitPriceVnd: number;
  totalVnd: number;
};

export type EInvoiceRequest = {
  /** The order this invoice bills — one invoice per closed order. */
  orderId: string;
  issuedAt: string;
  seller: {
    name: string;
    taxCode: string;
    address: string;
  };
  /** Walk-in guests are legal to invoice without buyer details. */
  buyer?: {
    name?: string;
    taxCode?: string;
  };
  lines: EInvoiceLine[];
  discountVnd: number;
  /** Grand total, VAT-inclusive, after discount — what the guest paid. */
  totalVnd: number;
  /** The VAT the total contains, at vatRatePct, rounded to whole VND. */
  vatVnd: number;
  vatRatePct: number;
};

export type EInvoiceIssueResult =
  | { ok: true; providerInvoiceId: string; lookupCode?: string }
  | { ok: false; error: string; retryable: boolean };

/** What every provider driver must be able to do. */
export interface EInvoiceProvider {
  readonly id: "misa" | "viettel" | "vnpt";
  /** False until real credentials are configured server-side. */
  configured(): boolean;
  issue(request: EInvoiceRequest): Promise<EInvoiceIssueResult>;
}

/**
 * The VAT a VAT-inclusive amount contains, in whole VND.
 *
 * Menu prices are quoted gross, so the invoice must extract the tax rather
 * than add it: 108.000đ at 8% contains 8.000đ of VAT, not 8.640đ. Rounded
 * half-up because the tax authority's own examples do.
 */
export function vatContainedVnd(grossVnd: number, ratePct: number): number {
  if (ratePct <= 0 || grossVnd <= 0) return 0;
  return Math.round((grossVnd * ratePct) / (100 + ratePct));
}

/**
 * Build the invoice from what the till already knows. The discount reduces
 * the taxable amount — VAT is owed on what was actually charged.
 */
export function buildInvoiceRequest(input: {
  orderId: string;
  issuedAt: string;
  seller: { name: string; taxCode: string; address: string };
  buyer?: { name?: string; taxCode?: string };
  lines: EInvoiceLine[];
  discountVnd: number;
  vatRatePct: number;
}): EInvoiceRequest {
  const grossLines = input.lines.reduce((sum, line) => sum + line.totalVnd, 0);
  const totalVnd = Math.max(0, grossLines - Math.max(0, input.discountVnd));
  return {
    orderId: input.orderId,
    issuedAt: input.issuedAt,
    seller: input.seller,
    buyer: input.buyer,
    lines: input.lines,
    discountVnd: Math.max(0, input.discountVnd),
    totalVnd,
    vatVnd: vatContainedVnd(totalVnd, input.vatRatePct),
    vatRatePct: input.vatRatePct,
  };
}
