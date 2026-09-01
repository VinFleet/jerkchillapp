import type { PrinterSettings, PrinterConfig } from "@/lib/types";
import { readList, writeList, isLegacyTenant } from "@/lib/storage";

/**
 * Where the printers live, as far as the app is concerned.
 *
 * A synced singleton on the receipt_settings pattern: edited on whichever
 * device is in someone's hand, pulled by the bridge from the shared store.
 * The IPs here are the restaurant's own LAN addresses — reference data about
 * the building, like the floor plan.
 */

const KEY = "printer_settings";

/** The 192.168.1.x addresses are Jerk & Chill's printers, not a template. */
export function defaultPrinters(): PrinterSettings {
  const legacy = isLegacyTenant();
  return {
    id: "printers",
    printers: [
      { key: "kitchen", host: legacy ? "192.168.1.199" : "", width: 42, enabled: legacy },
      { key: "receipt", host: legacy ? "192.168.1.198" : "", width: 42, enabled: legacy },
      // Off until a bar printer exists; while off, drinks print at the kitchen.
      { key: "bar", host: "", width: 42, enabled: false },
    ],
    autoPrintKitchen: true,
    autoPrintReceiptOnClose: true,
    updatedAt: new Date(0).toISOString(),
  };
}

export function getPrinterSettings(): PrinterSettings {
  const defaults = defaultPrinters();
  const stored = readList<PrinterSettings>(KEY).find((r) => r.id === "printers");
  if (!stored) return defaults;
  // Merge the printer list by key, not wholesale: a record saved before a
  // station existed (bar arrived after kitchen/receipt) must still show it.
  const printers = defaults.printers.map(
    (d) => stored.printers?.find((p) => p.key === d.key) ?? d
  );
  return { ...defaults, ...stored, printers };
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
