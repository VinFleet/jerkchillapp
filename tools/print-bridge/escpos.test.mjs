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
  qr,
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
