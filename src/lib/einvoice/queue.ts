import { supabase } from "@/lib/supabase/client";
import { getActiveTenant } from "@/lib/storage";
import { getBill } from "@/lib/repo/orders";
import { getMenuItems } from "@/lib/repo/menu";
import { getReceiptSettings } from "@/lib/repo/receiptSettings";
import { getEInvoiceSettings } from "./settings";
import { buildInvoiceRequest } from "./types";
import type { Order } from "@/lib/types";

/**
 * Enqueue an e-invoice for a just-closed order — the till's whole job here.
 *
 * Fire-and-forget on the same reasoning as printing: the guest is standing
 * up, and the issuing (credentials, provider API, retries) is server work.
 * Nothing happens unless the branch has e-invoicing switched on, and a
 * failure to enqueue never blocks closing the table — the queue's unique
 * index means a later retry for the same order updates rather than
 * duplicates.
 */
export async function maybeQueueEInvoice(order: Order): Promise<void> {
  const settings = getEInvoiceSettings();
  if (!settings.enabled || !supabase) return;

  const receipt = getReceiptSettings();
  if (!receipt.taxCode) return; // an invoice without a seller tax code is not an invoice

  const bill = getBill(order.id);
  if (!bill || bill.totalVnd <= 0) return;

  const menu = getMenuItems(false);
  const nameOf = (id: string) =>
    id.startsWith("adhoc:") ? id.slice(6) : (menu.find((m) => m.id === id)?.name.vi ?? id);

  const request = buildInvoiceRequest({
    orderId: order.id,
    issuedAt: new Date().toISOString(),
    seller: {
      name: receipt.headerName,
      taxCode: receipt.taxCode,
      address: receipt.addressLine ?? "",
    },
    buyer: order.customerName ? { name: order.customerName } : undefined,
    lines: order.lines
      .filter((l) => l.status !== "cancelled")
      .map((l) => ({
        name: nameOf(l.menuItemId),
        qty: l.qty,
        unitPriceVnd: l.unitPriceVnd,
        totalVnd: l.unitPriceVnd * l.qty,
      })),
    discountVnd: bill.discountVnd,
    vatRatePct: settings.vatRatePct,
  });

  await supabase
    .from("einvoice_jobs")
    .upsert(
      {
        tenant_id: getActiveTenant(),
        order_id: order.id,
        request,
        provider: settings.provider,
      },
      { onConflict: "tenant_id,order_id" }
    )
    .then(
      () => undefined,
      () => undefined // offline: closing the table still wins; retry is manual for now
    );
}
