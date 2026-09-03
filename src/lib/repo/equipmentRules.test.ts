import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTargetRangeC, validateCustomEquipment, equipmentSummary } from "./equipmentRules.ts";

test("default ranges match how each category is actually run", () => {
  assert.deepEqual(defaultTargetRangeC("fridge"), { minC: 0, maxC: 5 });
  assert.deepEqual(defaultTargetRangeC("freezer"), { minC: -22, maxC: -18 });
  assert.deepEqual(defaultTargetRangeC("combo"), { minC: -18, maxC: 5 });
});

const valid = { brand: "Sanaky", model: "VH-2599W1", minC: -22, maxC: -18 };

test("a complete custom entry is accepted", () => {
  assert.deepEqual(validateCustomEquipment(valid), { ok: true });
  assert.deepEqual(validateCustomEquipment({ ...valid, capacityLiters: 208 }), { ok: true });
});

test("brand and model are both required — an unnamed fridge helps nobody later", () => {
  assert.deepEqual(validateCustomEquipment({ ...valid, brand: "  " }), { ok: false, reason: "brand" });
  assert.deepEqual(validateCustomEquipment({ ...valid, model: "" }), { ok: false, reason: "model" });
});

test("min must be below max, or every reading is both in and out of range", () => {
  assert.deepEqual(validateCustomEquipment({ ...valid, minC: -18, maxC: -18 }), { ok: false, reason: "range" });
  assert.deepEqual(validateCustomEquipment({ ...valid, minC: 5, maxC: -18 }), { ok: false, reason: "range" });
  assert.deepEqual(validateCustomEquipment({ ...valid, minC: NaN, maxC: -18 }), { ok: false, reason: "range" });
});

test("capacity, when given, must be a positive number", () => {
  assert.deepEqual(validateCustomEquipment({ ...valid, capacityLiters: 0 }), { ok: false, reason: "capacity" });
  assert.deepEqual(validateCustomEquipment({ ...valid, capacityLiters: -50 }), { ok: false, reason: "capacity" });
  assert.deepEqual(validateCustomEquipment({ ...valid, capacityLiters: NaN }), { ok: false, reason: "capacity" });
});

test("the summary line", () => {
  assert.equal(equipmentSummary("Sanaky", "VH-2599W1", 208), "Sanaky VH-2599W1 · 208L");
  assert.equal(equipmentSummary("Sanaky", "VH-2599W1", null), "Sanaky VH-2599W1");
  assert.equal(equipmentSummary(undefined, undefined, null), null, "an old seeded unit with no brand shows nothing extra");
});
