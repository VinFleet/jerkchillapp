import { test } from "node:test";
import assert from "node:assert/strict";
import { vatContainedVnd, buildInvoiceRequest } from "./types.ts";

test("VAT is extracted from gross, not added to it", () => {
  // 108.000d gross at 8% contains 8.000d of VAT — the naive *8% gives 8.640.
  assert.equal(vatContainedVnd(108_000, 8), 8_000);
  assert.equal(vatContainedVnd(110_000, 10), 10_000);
  assert.equal(vatContainedVnd(0, 8), 0);
  assert.equal(vatContainedVnd(100_000, 0), 0);
});

test("awkward totals round to whole VND, half up", () => {
  // 199.000 at 8%: 199000*8/108 = 14740.74 -> 14741
  assert.equal(vatContainedVnd(199_000, 8), 14_741);
  // 85.000 at 10%: 85000*10/110 = 7727.27 -> 7727
  assert.equal(vatContainedVnd(85_000, 10), 7_727);
});

const seller = { name: "Test Quan", taxCode: "0312345678", address: "Thao Dien, HCMC" };

test("the discount reduces the taxable amount", () => {
  const req = buildInvoiceRequest({
    orderId: "o1",
    issuedAt: "2026-09-02T12:00:00.000Z",
    seller,
    lines: [
      { name: "Jerk Chicken", qty: 2, unitPriceVnd: 165_000, totalVnd: 330_000 },
      { name: "Rum Punch", qty: 1, unitPriceVnd: 120_000, totalVnd: 120_000 },
    ],
    discountVnd: 50_000,
    vatRatePct: 8,
  });
  assert.equal(req.totalVnd, 400_000, "VAT is owed on what was actually charged");
  assert.equal(req.vatVnd, vatContainedVnd(400_000, 8));
});

test("a discount larger than the bill clamps to zero, never negative", () => {
  const req = buildInvoiceRequest({
    orderId: "o2",
    issuedAt: "2026-09-02T12:00:00.000Z",
    seller,
    lines: [{ name: "Coffee", qty: 1, unitPriceVnd: 45_000, totalVnd: 45_000 }],
    discountVnd: 100_000,
    vatRatePct: 8,
  });
  assert.equal(req.totalVnd, 0);
  assert.equal(req.vatVnd, 0);
});

test("a negative discount is treated as no discount, not a surcharge", () => {
  const req = buildInvoiceRequest({
    orderId: "o3",
    issuedAt: "2026-09-02T12:00:00.000Z",
    seller,
    lines: [{ name: "Coffee", qty: 1, unitPriceVnd: 45_000, totalVnd: 45_000 }],
    discountVnd: -10_000,
    vatRatePct: 8,
  });
  assert.equal(req.totalVnd, 45_000);
  assert.equal(req.discountVnd, 0);
});
