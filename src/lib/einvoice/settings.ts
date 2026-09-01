import { readList, writeList } from "@/lib/storage";

/**
 * Per-branch e-invoice posture — a synced singleton on the printer_settings
 * pattern. Holds no credentials (a synced row is readable by every member);
 * those live server-side with the driver. Seller identity (name, tax code,
 * address) comes from receipt_settings, which already holds it for the bill.
 */

const KEY = "einvoice_settings";

export type EInvoiceSettings = {
  id: "einvoice";
  /** Off until a provider integration is live for this branch. */
  enabled: boolean;
  provider: "misa" | "viettel" | "vnpt";
  /** F&B is 8% (reduced) or 10%; a setting because the law moves. */
  vatRatePct: number;
  updatedAt: string;
};

export function defaultEInvoiceSettings(): EInvoiceSettings {
  return {
    id: "einvoice",
    enabled: false,
    provider: "misa",
    vatRatePct: 8,
    updatedAt: new Date(0).toISOString(),
  };
}

export function getEInvoiceSettings(): EInvoiceSettings {
  const stored = readList<EInvoiceSettings>(KEY).find((r) => r.id === "einvoice");
  return { ...defaultEInvoiceSettings(), ...stored };
}

export function saveEInvoiceSettings(patch: Partial<Omit<EInvoiceSettings, "id" | "updatedAt">>) {
  const next: EInvoiceSettings = {
    ...getEInvoiceSettings(),
    ...patch,
    id: "einvoice",
    updatedAt: new Date().toISOString(),
  };
  writeList(KEY, [next]);
}
