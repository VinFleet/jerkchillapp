import type { PrinterSettings, PrinterConfig } from "@/lib/types";
import { readList, writeList } from "@/lib/storage";

/**
 * Where the printers live, as far as the app is concerned.
 *
 * A synced singleton on the receipt_settings pattern: edited on whichever
 * device is in someone's hand, pulled by the bridge from the shared store.
 * The IPs here are the restaurant's own LAN addresses — reference data about
 * the building, like the floor plan.
 */

const KEY = "printer_settings";

export const DEFAULT_PRINTERS: PrinterSettings = {
  id: "printers",
  printers: [
    { key: "kitchen", host: "192.168.1.199", width: 42, enabled: true },
    { key: "receipt", host: "192.168.1.198", width: 42, enabled: true },
  ],
  autoPrintKitchen: true,
  autoPrintReceiptOnClose: true,
  updatedAt: new Date(0).toISOString(),
};

export function getPrinterSettings(): PrinterSettings {
  const stored = readList<PrinterSettings>(KEY).find((r) => r.id === "printers");
  return { ...DEFAULT_PRINTERS, ...stored };
}

export function savePrinterSettings(
  patch: Partial<Omit<PrinterSettings, "id" | "updatedAt">>
) {
  const next: PrinterSettings = {
    ...getPrinterSettings(),
    ...patch,
    id: "printers",
    updatedAt: new Date().toISOString(),
  };
  writeList(KEY, [next]);
}

/** A LAN address, roughly — enough to catch a phone number in the IP field. */
export function looksLikeHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(host.trim());
}

export function printerFor(settings: PrinterSettings, key: PrinterConfig["key"]) {
  return settings.printers.find((p) => p.key === key);
}
