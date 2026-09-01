import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPin, verifyPin, newSalt, isHashedPin } from "./pin.ts";

test("a hashed PIN verifies and a wrong one does not", async () => {
  const stored = await hashPin("1234", newSalt());
  assert.ok(isHashedPin(stored));
  assert.ok(!stored.includes("1234"), "the digits must not appear in what is stored");
  assert.equal(await verifyPin("1234", stored), true);
  assert.equal(await verifyPin("1235", stored), false);
  assert.equal(await verifyPin("", stored), false);
});

test("the same PIN hashes differently per person (salt), same within one record", async () => {
  const a = await hashPin("1234", newSalt());
  const b = await hashPin("1234", newSalt());
  assert.notEqual(a, b, "two people with the same PIN must not share a hash");
  const salt = a.split(":")[1];
  assert.equal(await hashPin("1234", salt), a, "deterministic for a given salt");
});

test("legacy plaintext PINs still verify, so the upgrade locks nobody out", async () => {
  assert.equal(await verifyPin("4321", "4321"), true);
  assert.equal(await verifyPin("0000", "4321"), false);
  assert.equal(isHashedPin("4321"), false);
});

test("no PIN set never verifies", async () => {
  assert.equal(await verifyPin("1234", undefined), false);
  assert.equal(await verifyPin("", undefined), false);
});

test("a mangled stored value fails closed", async () => {
  assert.equal(await verifyPin("1234", "sha256:"), false);
  assert.equal(await verifyPin("1234", "sha256::"), false);
});
