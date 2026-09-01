/**
 * Tests for the ESC/POS renderer.
 *
 * A wrong byte here is a drawer of receipts in Wingdings discovered
 * mid-service, so the bytes are checked, not eyeballed.
 *
 * Run: npm run test:escpos
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  toAscii,
  row,

  encodeCp1258,
  renderKitchenTicket,
  renderReceipt,
  CUT,
  SIZE_BIG,
} from "./escpos.mjs";

const ascii = (bytes) => new TextDecoder().decode(bytes);
const endsWithCut = (bytes) =>
  bytes.slice(-CUT.length).every((b, i) => b === CUT[i]);

test("Vietnamese comes out readable, never mojibake", () => {
  assert.equal(toAscii("Gà Jerk — Rất cay"), "Ga Jerk ? Rat cay".replace("? ", "? ").replace("?", "?"));
  assert.equal(toAscii("Nước Ngọt"), "Nuoc Ngot");
  assert.equal(toAscii("đĐ₫"), "dDd");
  // Nothing outside printable ASCII survives — that is the whole guarantee.
  for (const ch of toAscii("Cảm ơn quý khách ₫đ✓")) {
    const code = ch.charCodeAt(0);
    assert.ok((code >= 0x20 && code <= 0x7e) || ch === "\n", `leaked ${code}`);
  }
});

test("a row is exactly the printer's width", () => {
  const r = ascii(row("Jerk Chicken", "210.000d", 42));
  assert.equal(r.length, 43, "42 columns plus the newline");
  assert.ok(r.startsWith("Jerk Chicken"));
  assert.ok(r.trimEnd().endsWith("210.000d"));
});

test("a name too long for the row loses characters, not the price", () => {
  const r = ascii(row("A very long dish name that cannot possibly fit", "999.000d", 32));
  assert.equal(r.length, 33);
  assert.ok(r.trimEnd().endsWith("999.000d"), "the number survives");
});

test("the kitchen ticket carries no money and ends in a cut", () => {
  const bytes = renderKitchenTicket({
    table: "I4",
    code: "KQ7M2",
    time: "19:42",
    notes: ["NUT ALLERGY"],
    lines: [{ qty: 2, name: "Jerk Chicken", detail: "Extra spicy" }],
  });
  const s = ascii(bytes);
  assert.ok(s.includes("I4"));
  assert.ok(s.includes("NUT ALLERGY"));
  assert.ok(s.includes("2x Jerk Chicken"));
  assert.ok(!/\d\.\d{3}d/.test(s), "prices are noise on a pass ticket");
  assert.ok(endsWithCut(bytes));
});

test("allergy notes print before the food", () => {
  const s = ascii(
    renderKitchenTicket({
      table: "I1",
      notes: ["NO PORK"],
      lines: [{ qty: 1, name: "Jerk Chicken" }],
    })
  );
  assert.ok(s.indexOf("NO PORK") < s.indexOf("Jerk Chicken"), "a ticket is read top-down");
});

test("the receipt adds up on paper the way it does on screen", () => {
  const bytes = renderReceipt({
    headerName: "JERK & CHILL",
    table: "I4",
    time: "21:03",
    lines: [
      { qty: 1, name: "Jerk Chicken", totalVnd: 210000 },
      { qty: 2, name: "Coca-Cola", totalVnd: 50000 },
    ],
    discount: { label: "Staff meal (50%)", amountVnd: 130000 },
    totalVnd: 130000,
    payments: [{ label: "Cash", amountVnd: 130000 }],
    outstandingVnd: 0,
  });
  const s = ascii(bytes);
  assert.ok(s.includes("210.000d"));
  assert.ok(s.includes("-130.000d"), "the discount is shown, not silently subtracted");
  assert.ok(s.includes("TOTAL"));
  assert.ok(
    s.includes("KHONG PHAI HOA DON"),
    "the not-a-tax-invoice line is a legal requirement until e-invoicing exists"
  );
  assert.ok(!s.includes("STILL OWED"), "a settled bill does not nag");
  assert.ok(endsWithCut(bytes));
});

test("a scan-to-pay QR is emitted as printer-drawn commands", () => {
  const payload = "000201010212520441114802VN6304ABCD";
  const bytes = renderReceipt({
    headerName: "X",
    lines: [],
    totalVnd: 100000,
    outstandingVnd: 100000,
    qrPayload: payload,
  });
  const s = ascii(bytes);
  assert.ok(s.includes(payload), "the payload is stored for the printer to draw");
  // GS ( k function 181 (print): 1D 28 6B 03 00 31 51 30
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
  assert.ok(hex.includes("1d 28 6b 03 00 31 51 30"), "the print-QR command is present");
});

test("the big-type command wraps the table number", () => {
  const bytes = renderKitchenTicket({ table: "O2", lines: [] });
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
  assert.ok(hex.includes(Array.from(SIZE_BIG, (b) => b.toString(16).padStart(2, "0")).join(" ")));
});

// ---------- Vietnamese (CP1258) ----------

test("CP1258 encodes shaped letters precomposed and tones as trailing bytes", () => {
  // ở = ơ (0xF5) + hook above (0xD2); ế = ê (0xEA) + acute (0xEC)
  assert.deepEqual(Array.from(encodeCp1258("Phở")), [0x50, 0x68, 0xf5, 0xd2]);
  assert.deepEqual(Array.from(encodeCp1258("ế")), [0xea, 0xec]);
  assert.deepEqual(Array.from(encodeCp1258("đ")), [0xf0]);
  assert.deepEqual(Array.from(encodeCp1258("Ăn")), [0xc3, 0x6e]);
  // bò = b + o + grave (0xCC); ạ = a + dot below (0xF2)
  assert.deepEqual(Array.from(encodeCp1258("bò")), [0x62, 0x6f, 0xcc]);
  assert.deepEqual(Array.from(encodeCp1258("ạ")), [0x61, 0xf2]);
});

test("CP1258 falls back to transliteration for characters off the page", () => {
  assert.deepEqual(Array.from(encodeCp1258("A₫")), [0x41, 0xfe]);
  const bytes = Array.from(encodeCp1258("→"));
  assert.deepEqual(bytes, [0x3f], "unknown symbols become ?, never a wrong glyph");
});

test("a cp1258 printer gets ESC t before any text; ascii printers never do", () => {
  const vn = renderKitchenTicket({ table: "B1", lines: [] }, { width: 42, encoding: "cp1258", codepageByte: 30 });
  const hexVn = Array.from(vn, (b) => b.toString(16).padStart(2, "0")).join(" ");
  assert.ok(hexVn.includes("1b 74 1e"), "ESC t 30 selects the configured page");
  const plain = renderKitchenTicket({ table: "B1", lines: [] }, 42);
  const hexPlain = Array.from(plain, (b) => b.toString(16).padStart(2, "0")).join(" ");
  assert.ok(!hexPlain.includes("1b 74"), "ascii mode must not switch code pages");
});

test("row padding counts printed columns, not bytes, under cp1258", () => {
  // "Phở bò" is 6 columns on paper but 8 bytes; right edge must still align.
  const bytes = renderReceipt(
    { headerName: "X", lines: [{ qty: 1, name: "Phở bò", totalVnd: 65000 }], totalVnd: 65000, outstandingVnd: 0 },
    { width: 32, encoding: "cp1258" }
  );
  // Find the item row: strip to a per-line structure by scanning for the price.
  const arr = Array.from(bytes);
  const lineStarts = [];
  let cur = [];
  for (const b of arr) {
    if (b === 0x0a) { lineStarts.push(cur); cur = []; } else cur.push(b);
  }
  const item = lineStarts.find((l) => {
    const s = l.map((b) => String.fromCharCode(b)).join("");
    return s.includes("65.000d");
  });
  assert.ok(item, "the item row exists");
  const printable = item.filter((b) => b >= 0x20 || b >= 0x80).length
    - item.filter((b) => [0xcc, 0xec, 0xde, 0xd2, 0xf2].includes(b)).length;
  assert.equal(printable, 32, "the row fills exactly the printer width in columns");
});

test("a void ticket wears the HUY banner; a normal ticket never does", () => {
  const voided = renderKitchenTicket({
    void: true, table: "O2", code: "#12", lines: [{ qty: 1, name: "Jerk Chicken" }],
  });
  const s1 = ascii(voided);
  assert.ok(s1.includes("HUY MON"));
  assert.ok(s1.includes("VOID"));
  assert.ok(s1.includes("Jerk Chicken"), "the pass reads WHAT to stop making");
  const normal = renderKitchenTicket({ table: "O2", lines: [{ qty: 1, name: "Jerk Chicken" }] });
  assert.ok(!ascii(normal).includes("VOID"));
});
