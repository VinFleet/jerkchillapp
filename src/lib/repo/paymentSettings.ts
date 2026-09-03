import { readList, writeList, readValue } from "@/lib/storage";

/**
 * The account a VietQR code pays into.
 *
 * Not a secret. A bank BIN and account number are what you print on an
 * invoice — the QR encodes exactly what a guest would otherwise type into
 * their banking app by hand. What it must be is *right*: a wrong digit sends
 * a night's takings to a stranger, so this is entered once by the owner and
 * shown back in full on the settings screen for checking, never truncated.
 *
 * Local rather than server-held because the till has to raise a QR with the
 * wifi down, and because it is per-restaurant reference data — the same
 * reason recipes do not sync.
 */

const KEY = "payment_settings";

export type PaymentSettings = {
  /** Singleton record id, for the sync engine. */
  id: "settings";
  /** Napas six-digit bank identifier, e.g. 970436 for Vietcombank. */
  bankBin: string;
  accountNumber: string;
  /** Shown by the guest's banking app before they confirm. */
  accountName: string;
  /** Whether the card rail is switched on at all. */
  cardEnabled: boolean;
  /**
   * Whether card payments are pushed to a 9Pay POS terminal instead of being
   * rung up on a separate machine and typed back in.
   *
   * Only the switch lives here. The merchant key, signing secret and
   * checksum key are per-branch server secrets (branch_secrets) — a synced
   * row is readable by every member, and whoever holds the checksum key can
   * forge a paid confirmation.
   */
  ninepayEnabled: boolean;
  updatedAt: string;
};

const EMPTY: PaymentSettings = {
  id: "settings",
  bankBin: "",
  accountNumber: "",
  accountName: "",
  cardEnabled: false,
  ninepayEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export function getPaymentSettings(): PaymentSettings {
  const stored = readList<PaymentSettings>(KEY);
  // The pre-sync shape was a bare object rather than a singleton list. Adopt
  // it once, so an account someone already typed survives the upgrade —
  // resetting a bank account silently is how money goes to the wrong place.
  if (!Array.isArray(stored)) {
    const legacy = readValue<Omit<PaymentSettings, "id" | "updatedAt">>(KEY, EMPTY);
    const adopted: PaymentSettings = {
      ...EMPTY,
      ...legacy,
      id: "settings",
      updatedAt: new Date().toISOString(),
    };
    writeList(KEY, [adopted]);
    return adopted;
  }
  return { ...EMPTY, ...stored.find((r) => r.id === "settings") };
}

export function savePaymentSettings(next: Omit<PaymentSettings, "id" | "updatedAt">): void {
  writeList(KEY, [
    {
      ...next,
      id: "settings" as const,
      bankBin: next.bankBin.trim(),
      // Vietnamese account numbers are digits; people paste them with spaces.
      accountNumber: next.accountNumber.replace(/\s+/g, ""),
      accountName: next.accountName.trim().toUpperCase(),
      updatedAt: new Date().toISOString(),
    },
  ]);
}

/**
 * Whether a QR can actually be raised.
 *
 * Checked before the button is offered rather than at the moment of payment:
 * discovering the account is unset while a guest is holding their phone out
 * is the worst possible time to find out.
 */
export function vietQrConfigured(): boolean {
  const s = getPaymentSettings();
  return /^\d{6}$/.test(s.bankBin) && /^\d{6,20}$/.test(s.accountNumber);
}
