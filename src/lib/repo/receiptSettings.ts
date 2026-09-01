import type { ReceiptSettings } from "@/lib/types";
import { readList, writeList } from "@/lib/storage";

/**
 * The bill's letterhead.
 *
 * Stored as a single-record synced collection rather than a local value,
 * because the bill prints from whichever device is nearest the guest — a
 * header the owner types on the laptop has to come out identical on the
 * kitchen tablet, and local-only settings would print two different
 * restaurants. Same precedent as menu_items: editable reference data that
 * must agree across devices syncs.
 */

const KEY = "receipt_settings";

export const DEFAULT_RECEIPT: ReceiptSettings = {
  id: "receipt",
  headerName: "JERK & CHILL",
  addressLine: "Thảo Điền, District 2, HCMC",
  phone: "",
  taxCode: "",
  wifiNote: "",
  footer: { en: "Thank you", vi: "Cảm ơn quý khách" },
  showLogo: true,
  showPaymentQr: true,
  updatedAt: new Date(0).toISOString(),
};

export function getReceiptSettings(): ReceiptSettings {
  const stored = readList<ReceiptSettings>(KEY).find((r) => r.id === "receipt");
  // Merged over the defaults so a device that synced an older shape still
  // prints a complete bill rather than dropping the newer fields.
  return { ...DEFAULT_RECEIPT, ...stored };
}

export function saveReceiptSettings(patch: Partial<Omit<ReceiptSettings, "id" | "updatedAt">>) {
  const next: ReceiptSettings = {
    ...getReceiptSettings(),
    ...patch,
    id: "receipt",
    updatedAt: new Date().toISOString(),
  };
  writeList(KEY, [next]);
}
