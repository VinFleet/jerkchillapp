/**
 * Builds a VietQR payload — the string a bank app reads when a guest scans.
 *
 * VietQR is the Napas national standard, accepted by ~50 Vietnamese banks, and
 * it is an EMVCo QR: a sequence of `IDLLVALUE` fields where ID and length are
 * two digits each, ending with a CRC-16/CCITT-FALSE over everything including
 * the CRC's own tag and length.
 *
 * Generating this costs nothing and needs no account — the payload is just a
 * formatted string. What costs money is *knowing it was paid*, which is a
 * separate service (SePay, Casso) watching the bank account and calling a
 * webhook. Nothing here should ever be taken as evidence of payment.
 *
 * Import-free on purpose: a malformed payload is silently rejected by the
 * banking app with no useful message, so this needs to be provable offline.
 */

/** Tag-length-value. Length is two digits, so a value over 99 chars cannot be encoded. */
function tlv(id: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`VietQR field ${id} is ${value.length} chars; the format allows 99`);
  }
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no final xor.
 *
 * Getting any of those four wrong produces a payload that looks right and
 * scans to nothing, which is the hardest kind of bug to see.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type VietQrInput = {
  /** Napas bank BIN, e.g. "970436" for Vietcombank. Six digits. */
  bankBin: string;
  /** The receiving account number. */
  accountNumber: string;
  /** Whole đồng. Omit for a QR the payer types an amount into. */
  amountVnd?: number;
  /** Our payment reference — what the webhook matches back to an order. */
  reference?: string;
};

const GUID_VIETQR = "A000000727";

/**
 * A dynamic VietQR payload.
 *
 * "Dynamic" means the amount and reference are baked in, so the guest confirms
 * rather than types — which is what makes automatic reconciliation possible at
 * all. A static QR forces the payer to enter both, and half of them will get
 * the reference wrong.
 */
export function buildVietQrPayload(input: VietQrInput): string {
  if (!/^\d{6}$/.test(input.bankBin)) {
    throw new Error(`Bank BIN must be six digits, got "${input.bankBin}"`);
  }
  if (!/^\d+$/.test(input.accountNumber)) {
    throw new Error("Account number must be digits only");
  }
  if (input.amountVnd !== undefined && !Number.isInteger(input.amountVnd)) {
    throw new Error(`Amount must be whole đồng, got ${input.amountVnd}`);
  }

  // Merchant account information, nested: the VietQR GUID, then the bank BIN
  // and account inside their own nested field.
  const beneficiary = tlv("00", input.bankBin) + tlv("01", input.accountNumber);
  const merchantAccount =
    tlv("00", GUID_VIETQR) + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");

  const parts = [
    tlv("00", "01"), // payload format indicator
    // 12 = dynamic, one-time use. 11 would be static and reusable, which
    // cannot carry an amount and so cannot be auto-reconciled.
    tlv("01", input.amountVnd !== undefined ? "12" : "11"),
    tlv("38", merchantAccount),
    tlv("53", "704"), // VND, ISO 4217
  ];

  if (input.amountVnd !== undefined) parts.push(tlv("54", String(input.amountVnd)));
  parts.push(tlv("58", "VN"));

  if (input.reference) {
    // Additional data, field 08 = reference label. This is the string the bank
    // memo carries and the webhook matches on.
    parts.push(tlv("62", tlv("08", input.reference)));
  }

  // The CRC covers everything before it *including* its own tag and length,
  // so "6304" is appended before computing.
  const body = parts.join("") + "6304";
  return body + crc16(body);
}

/** Confirms a payload's CRC — useful for testing a value read back off a QR. */
export function isValidVietQrPayload(payload: string): boolean {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const supplied = payload.slice(-4).toUpperCase();
  return body.endsWith("6304") && crc16(body) === supplied;
}
