import { readValue, writeValue } from "@/lib/storage";

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
  /** Napas six-digit bank identifier, e.g. 970436 for Vietcombank. */
  bankBin: string;
  accountNumber: string;
  /** Shown by the guest's banking app before they confirm. */
  accountName: string;
  /** Whether the card rail is switched on at all. */
  cardEnabled: boolean;
};

const EMPTY: PaymentSettings = {
  bankBin: "",
  accountNumber: "",
  accountName: "",
  cardEnabled: false,
};

export function getPaymentSettings(): PaymentSettings {
  return readValue<PaymentSettings>(KEY, EMPTY);
}

export function savePaymentSettings(next: PaymentSettings): void {
  writeValue(KEY, {
    ...next,
    bankBin: next.bankBin.trim(),
    // Vietnamese account numbers are digits; people paste them with spaces.
    accountNumber: next.accountNumber.replace(/\s+/g, ""),
    accountName: next.accountName.trim().toUpperCase(),
  });
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
