/**
 * Convergence tests for the payment merge.
 *
 * The invariant (CLAUDE.md rule 4): merge functions are pure, and any order
 * of merging reaches the same state, and merging twice changes nothing. For
 * payments the stakes are concrete — a slip photo attached on one device and
 * a confirmation that arrived on another must both survive whichever device
 * merges first.
 *
 * Run: npm run test:sync
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { SYNCED_COLLECTIONS } from "./collections.ts";

const reconcile = SYNCED_COLLECTIONS.order_payments.reconcile!;

type P = {
  id: string;
  status: string;
  createdAt: string;
  confirmedAt?: string;
  slipPhotoPath?: string;
  providerRef?: string;
};

const base: P = { id: "pay_1", status: "pending", createdAt: "2026-09-01T12:00:00Z" };

test("a confirmation beats a stale pending copy, from either side", () => {
  const pending = { ...base };
  const paid = { ...base, status: "paid", confirmedAt: "2026-09-01T12:05:00Z" };
  assert.equal((reconcile(pending, paid) as P).status, "paid");
  assert.equal((reconcile(paid, pending) as P).status, "paid");
});

test("a slip photographed on the losing side still survives", () => {
  // Device A confirmed the payment; device B photographed the slip. Whoever
  // merges, both facts must come through.
  const withSlip = { ...base, slipPhotoPath: "pay_1.jpg" };
  const paid = { ...base, status: "paid", confirmedAt: "2026-09-01T12:05:00Z" };
  assert.equal((reconcile(withSlip, paid) as P).slipPhotoPath, "pay_1.jpg");
  assert.equal((reconcile(paid, withSlip) as P).slipPhotoPath, "pay_1.jpg");
  assert.equal((reconcile(paid, withSlip) as P).status, "paid");
});

test("a typed card reference survives the same way", () => {
  const withRef = { ...base, providerRef: "APPR123" };
  const refunded = { ...base, status: "refunded" };
  assert.equal((reconcile(refunded, withRef) as P).providerRef, "APPR123");
  assert.equal((reconcile(withRef, refunded) as P).status, "refunded");
});

test("merging is idempotent", () => {
  const paid = {
    ...base,
    status: "paid",
    confirmedAt: "2026-09-01T12:05:00Z",
    slipPhotoPath: "pay_1.jpg",
  };
  const once = reconcile(base, paid);
  const twice = reconcile(once, paid);
  assert.deepEqual(twice, once);
});

test("merge order does not change the outcome", () => {
  const a = { ...base, status: "paid", confirmedAt: "2026-09-01T12:05:00Z" };
  const b = { ...base, slipPhotoPath: "pay_1.jpg", providerRef: "APPR9" };
  const ab = reconcile(a, b) as P;
  const ba = reconcile(b, a) as P;
  assert.deepEqual(
    { status: ab.status, slip: ab.slipPhotoPath, ref: ab.providerRef, at: ab.confirmedAt },
    { status: ba.status, slip: ba.slipPhotoPath, ref: ba.providerRef, at: ba.confirmedAt }
  );
});

test("both refunded keeps refunded — money cannot un-move", () => {
  const r1 = { ...base, status: "refunded" };
  const r2 = { ...base, status: "refunded" };
  assert.equal((reconcile(r1, r2) as P).status, "refunded");
});
