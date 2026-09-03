import { test } from "node:test";
import assert from "node:assert/strict";
import { supplierCertStatus } from "./supplierRules.ts";

const TODAY = "2026-09-04";

test("no expiry on file is its own state, not silently valid", () => {
  assert.equal(supplierCertStatus(undefined, TODAY), "not_set");
});

test("a date in the past is expired", () => {
  assert.equal(supplierCertStatus("2026-08-01", TODAY), "expired");
});

test("yesterday is expired, today itself is not", () => {
  assert.equal(supplierCertStatus("2026-09-03", TODAY), "expired");
  assert.equal(supplierCertStatus("2026-09-04", TODAY), "expiring");
});

test("within the 30-day lead window is expiring", () => {
  assert.equal(supplierCertStatus("2026-09-20", TODAY), "expiring");
  assert.equal(supplierCertStatus("2026-10-04", TODAY), "expiring", "exactly 30 days out is inclusive");
});

test("beyond the lead window is valid", () => {
  assert.equal(supplierCertStatus("2026-10-05", TODAY), "valid");
  assert.equal(supplierCertStatus("2027-01-01", TODAY), "valid");
});
