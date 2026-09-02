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

/**
 * Windows-1258 — the code page built for Vietnamese, and the reason it fits
 * in one byte table: letters with a shape (â ă ơ ư ê ô đ) are precomposed,
 * and the five TONES are combining bytes printed after the letter. So "ế" is
 * two bytes: ê then acute. Printers with a CP1258 font overstrike them.
 */
const CP1258_TONE = { "̀": 0xcc, "́": 0xec, "̃": 0xde, "̉": 0xd2, "̣": 0xf2 };
const CP1258_SHAPE = new Set(["̂", "̆", "̛"]); // circumflex, breve, horn
const CP1258_EXTRA = { "Ă": 0xc3, "ă": 0xe3, "Ơ": 0xd5, "ơ": 0xf5, "Ư": 0xdd, "ư": 0xfd, "Đ": 0xd0, "đ": 0xf0, "₫": 0xfe, "€": 0x80 };
// Latin-1 positions CP1258 reassigned — these may NOT pass through by codepoint.
const CP1258_REPLACED = new Set([0xc3, 0xcc, 0xd0, 0xd2, 0xd5, 0xdd, 0xde, 0xe3, 0xec, 0xf0, 0xf2, 0xf5, 0xfd, 0xfe]);

export function encodeCp1258(str) {
  const out = [];
  const s = String(str).normalize("NFD");
  let i = 0;
  while (i < s.length) {
    let base = s[i];
    i += 1;
    const tones = [];
    while (i < s.length) {
      const mark = s[i];
      if (CP1258_SHAPE.has(mark)) {
        base = (base + mark).normalize("NFC");
        i += 1;
      } else if (CP1258_TONE[mark] !== undefined) {
        tones.push(CP1258_TONE[mark]);
        i += 1;
      } else if (/[̀-ͯ]/.test(mark)) {
        i += 1; // a mark the page has no byte for: drop it, keep the letter
      } else {
        break;
      }
    }
    const cp = base.codePointAt(0);
    let byte;
    if (CP1258_EXTRA[base] !== undefined) byte = CP1258_EXTRA[base];
    else if ((cp >= 0x20 && cp <= 0x7e) || base === "\n") byte = cp;
    else if (cp >= 0xa0 && cp <= 0xff && !CP1258_REPLACED.has(cp)) byte = cp;
    if (byte === undefined) {
      for (const b of new TextEncoder().encode(toAscii(base))) out.push(b);
    } else {
      out.push(byte, ...tones);
    }
  }
  return Uint8Array.from(out);
}

export function encodeText(s, encoding) {
  return encoding === "cp1258" ? encodeCp1258(s) : new TextEncoder().encode(toAscii(s));
}

/** ESC t n — select the printer's font page. Only ever sent for cp1258. */
export function codepage(n) {
  return Uint8Array.from([ESC, 0x74, n & 0xff]);
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
 * Renderers take a width (the old call shape) or an options object with the
 * printer's encoding. The helpers returned here are the same line/row/rule
 * as the exported ones, bound to that encoding — CP1258 tone bytes are
 * zero-width on paper, so padding counts CLUSTERS, not bytes.
 */
function renderOpts(widthOrOpts) {
  const o = typeof widthOrOpts === "number" ? { width: widthOrOpts } : { ...widthOrOpts };
  const width = o.width ?? 42;
  const encoding = o.encoding === "cp1258" ? "cp1258" : "ascii";
  const printed = (s) => (encoding === "cp1258" ? String(s).normalize("NFC").replace(/[̀-ͯ]/g, "") : toAscii(s));
  const tx = (s) => encodeText(s, encoding);
  const ln = (s = "") => tx(s + "\n");
  const rw = (left, right, w) => {
    const visL = printed(left);
    const visR = printed(right);
    const keepL = visL.slice(0, w - visR.length - 1);
    const space = Math.max(1, w - keepL.length - visR.length);
    return ln(keepL + " ".repeat(space) + visR);
  };
  const setup = [INIT];
  if (encoding === "cp1258") setup.push(codepage(o.codepageByte ?? 94));
  return { width, tx, ln, rw, rl: (w) => ln("-".repeat(w)), setup };
}

/**
 * The kitchen ticket. No money on it, ever — the table, the time, the items,
 * and above them the things that change how a dish is cooked. A void ticket
 * is the same ticket wearing a banner: the pass reads WHAT to stop making in
 * the same layout it read what to make.
 */
export function renderKitchenTicket(job, widthOrOpts = 42) {
  const { width, ln, rw, rl, setup } = renderOpts(widthOrOpts);
  const parts = [...setup, ALIGN_LEFT];
  if (job.void) {
    parts.push(ALIGN_CENTER, SIZE_BIG, BOLD_ON, ln("** HUY MON **"), ln("** VOID **"), BOLD_OFF, SIZE_NORMAL, ALIGN_LEFT);
  }
  parts.push(SIZE_BIG, ln(job.table ?? "COUNTER"), SIZE_NORMAL);
  parts.push(rw(job.code ?? "", job.time ?? "", width));
  if (job.placedBy) parts.push(ln(job.placedBy));
  parts.push(rl(width));

  for (const note of job.notes ?? []) {
    parts.push(BOLD_ON, ln(`!! ${note}`), BOLD_OFF);
  }
  if ((job.notes ?? []).length) parts.push(rl(width));

  for (const item of job.lines ?? []) {
    parts.push(SIZE_BIG, ln(`${item.qty}x ${item.name}`), SIZE_NORMAL);
    if (item.detail) parts.push(BOLD_ON, ln(`   ${item.detail}`), BOLD_OFF);
    if (item.note) parts.push(BOLD_ON, ln(`   -> ${item.note}`), BOLD_OFF);
  }

  parts.push(ln(), CUT);
  return concat(parts);
}

/** The guest's receipt — the same content as the on-screen bill. */
export function renderReceipt(job, widthOrOpts = 42) {
  const { width, ln, rw, rl, setup } = renderOpts(widthOrOpts);
  const parts = [...setup, ALIGN_CENTER];
  parts.push(SIZE_BIG, ln(job.headerName ?? ""), SIZE_NORMAL);
  if (job.addressLine) parts.push(ln(job.addressLine));
  if (job.metaLine) parts.push(ln(job.metaLine));
  // Until e-invoicing is live, the paper must say what it is not. A receipt
  // that could be mistaken for a hoa don is a tax problem for the customer.
  parts.push(BOLD_ON, ln("PHIEU TINH TIEN - KHONG PHAI HOA DON"), BOLD_OFF);
  parts.push(ln("Bill - not a tax invoice"));
  parts.push(ALIGN_LEFT, rl(width));
  parts.push(rw(`Table ${job.table ?? "-"}`, job.time ?? "", width));
  if (job.servedBy) parts.push(ln(job.servedBy));
  parts.push(rl(width));

  for (const item of job.lines ?? []) {
    parts.push(rw(`${item.qty}x ${item.name}`, vnd(item.totalVnd), width));
    if (item.detail) parts.push(ln(`   ${item.detail}`));
  }

  parts.push(rl(width));
  if (job.discount) parts.push(rw(job.discount.label, `-${vnd(job.discount.amountVnd)}`, width));
  parts.push(BOLD_ON, rw("TOTAL / TONG CONG", vnd(job.totalVnd ?? 0), width), BOLD_OFF);
  for (const p of job.payments ?? []) {
    parts.push(rw(p.label, vnd(p.amountVnd), width));
  }
  if (job.outstandingVnd > 0) {
    parts.push(BOLD_ON, rw("STILL OWED / CON LAI", vnd(job.outstandingVnd), width), BOLD_OFF);
  }

  if (job.qrPayload) {
    parts.push(ALIGN_CENTER, ln(), ln("Scan to pay / Quet de thanh toan"), qr(job.qrPayload));
  }
  if (job.wifiNote) parts.push(ALIGN_CENTER, ln(), ln(job.wifiNote));
  if (job.footer) parts.push(ALIGN_CENTER, ln(), ln(job.footer));

  parts.push(ln(), CUT);
  return concat(parts);
}
