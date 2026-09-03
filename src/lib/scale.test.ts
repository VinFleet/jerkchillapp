import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleQty, formatQty } from "./scale.ts";

test("ordinary scaling rounds to 2dp as before", () => {
  assert.equal(scaleQty(2, 4, 8), 4);
  assert.equal(scaleQty(1.5, 4, 8), 3);
  assert.equal(scaleQty(2, 3, 1), 0.67);
});

test("a genuinely positive quantity never rounds away to a bare zero", () => {
  // 2 units at a 500-portion base, scaled down to 1 portion: 2/500 = 0.004
  const scaled = scaleQty(2, 500, 1);
  assert.notEqual(scaled, 0, "the true value must survive, not collapse to nothing");
  assert.equal(formatQty(scaled), "<0.01", "a chef must see a trace amount, not 'not needed'");
});

test("an ingredient that is genuinely absent still reads as 0", () => {
  assert.equal(scaleQty(0, 4, 8), 0);
  assert.equal(formatQty(0), "0");
});

test("formatQty strips trailing zeros but keeps real precision", () => {
  assert.equal(formatQty(4), "4");
  assert.equal(formatQty(4.5), "4.5");
  assert.equal(formatQty(4.25), "4.25");
  assert.equal(formatQty(4.2), "4.2");
});

test("the <0.01 threshold is exact — 0.01 itself is not a trace amount", () => {
  assert.equal(formatQty(0.01), "0.01");
  assert.equal(formatQty(0.005), "<0.01");
});
