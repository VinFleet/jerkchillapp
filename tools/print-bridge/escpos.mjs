/**
 * ESC/POS rendering — pure functions, no I/O.
 *
 * Kept apart from the bridge so the bytes can be tested without a printer:
 * a wrong byte here is a drawer of receipts in Wingdings, discovered
 * mid-service. Everything returns Uint8Array.
 *
 * Text is transliterated to ASCII before encoding. Cheap thermal printers
 * disagree wildly about Vietnamese codepages, and a receipt without diacritics
 * is normal on Vietnamese paper; a receipt in mojibake is not.
 */

const ESC = 0x1b;
const GS = 0x1d;

export const INIT = Uint8Array.from([ESC, 0x40]);
export const CUT = Uint8Array.from([GS, 0x56, 0x42, 0x03]); // feed + partial cut
export const ALIGN_LEFT = Uint8Array.from([ESC, 0x61, 0x00]);
export const ALIGN_CENTER = Uint8Array.from([ESC, 0x61, 0x01]);
export const BOLD_ON = Uint8Array.from([ESC, 0x45, 0x01]);
export const BOLD_OFF = Uint8Array.from([ESC, 0x45, 0x00]);
export const SIZE_BIG = Uint8Array.from([GS, 0x21, 0x11]); // double width+height
export const SIZE_NORMAL = Uint8Array.from([GS, 0x21, 0x00]);

/** Vietnamese to plain ASCII: strip combining marks, map đ, drop the rest. */
export function toAscii(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/₫/g, "d")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

export function text(s) {
  return new TextEncoder().encode(toAscii(s));
}

export function line(s = "") {
  return text(s + "\n");
}

/** "name .......... price" padded to the printer's column count. */
export function row(left, right, width) {
  const l = toAscii(left);
  const r = toAscii(right);
  const space = Math.max(1, width - l.length - r.length);
  return line(l.slice(0, width - r.length - 1) + " ".repeat(space) + r);
}

export function rule(width) {
  return line("-".repeat(width));
}

export function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * A QR the printer draws itself (GS ( k), for scan-to-pay on the receipt.
 * Module size 6, error level M — the same choices as the on-screen QR, for
 * the same reason: scanned at arm's length under restaurant light.
 */
export function qr(payload) {
  const data = new TextEncoder().encode(payload); // EMVCo payloads are ASCII
  const store = [GS, 0x28, 0x6b, (data.length + 3) & 0xff, (data.length + 3) >> 8, 0x31, 0x50, 0x30];
  return concat([
    Uint8Array.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // model 2
    Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]), // size 6
    Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]), // error M
    Uint8Array.from(store),
    data,
    Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]), // print
  ]);
}

const vnd = (n) => `${Number(n).toLocaleString("en-US").replace(/,/g, ".")}d`;

/**
 * The kitchen ticket. No money on it, ever — the table, the time, the items,
 * and above them the things that change how a dish is cooked.
 */
export function renderKitchenTicket(job, width = 42) {
  const parts = [INIT, ALIGN_LEFT];
  parts.push(SIZE_BIG, line(job.table ?? "COUNTER"), SIZE_NORMAL);
  parts.push(row(job.code ?? "", job.time ?? "", width));
  if (job.placedBy) parts.push(line(job.placedBy));
  parts.push(rule(width));

  for (const note of job.notes ?? []) {
    parts.push(BOLD_ON, line(`!! ${note}`), BOLD_OFF);
  }
  if ((job.notes ?? []).length) parts.push(rule(width));

  for (const item of job.lines ?? []) {
    parts.push(SIZE_BIG, line(`${item.qty}x ${item.name}`), SIZE_NORMAL);
    if (item.detail) parts.push(BOLD_ON, line(`   ${item.detail}`), BOLD_OFF);
    if (item.note) parts.push(BOLD_ON, line(`   -> ${item.note}`), BOLD_OFF);
  }

  parts.push(line(), CUT);
  return concat(parts);
}

/** The guest's receipt — the same content as the on-screen bill. */
export function renderReceipt(job, width = 42) {
  const parts = [INIT, ALIGN_CENTER];
  parts.push(SIZE_BIG, line(job.headerName ?? ""), SIZE_NORMAL);
  if (job.addressLine) parts.push(line(job.addressLine));
  if (job.metaLine) parts.push(line(job.metaLine));
  // Until e-invoicing is live, the paper must say what it is not. A receipt
  // that could be mistaken for a hoa don is a tax problem for the customer.
  parts.push(BOLD_ON, line("PHIEU TINH TIEN - KHONG PHAI HOA DON"), BOLD_OFF);
  parts.push(line("Bill - not a tax invoice"));
  parts.push(ALIGN_LEFT, rule(width));
  parts.push(row(`Table ${job.table ?? "-"}`, job.time ?? "", width));
  if (job.servedBy) parts.push(line(job.servedBy));
  parts.push(rule(width));

  for (const item of job.lines ?? []) {
    parts.push(row(`${item.qty}x ${item.name}`, vnd(item.totalVnd), width));
    if (item.detail) parts.push(line(`   ${item.detail}`));
  }

  parts.push(rule(width));
  if (job.discount) parts.push(row(job.discount.label, `-${vnd(job.discount.amountVnd)}`, width));
  parts.push(BOLD_ON, row("TOTAL / TONG CONG", vnd(job.totalVnd ?? 0), width), BOLD_OFF);
  for (const p of job.payments ?? []) {
    parts.push(row(p.label, vnd(p.amountVnd), width));
  }
  if (job.outstandingVnd > 0) {
    parts.push(BOLD_ON, row("STILL OWED / CON LAI", vnd(job.outstandingVnd), width), BOLD_OFF);
  }

  if (job.qrPayload) {
    parts.push(ALIGN_CENTER, line(), line("Scan to pay / Quet de thanh toan"), qr(job.qrPayload));
  }
  if (job.wifiNote) parts.push(ALIGN_CENTER, line(), line(job.wifiNote));
  if (job.footer) parts.push(ALIGN_CENTER, line(), line(job.footer));

  parts.push(line(), CUT);
  return concat(parts);
}
