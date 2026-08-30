import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBsb, formatBsb, assertValidAccountNumber } from "./bank-details.ts";

test("normalizeBsb strips separators and accepts 6 digits", () => {
  assert.equal(normalizeBsb("123-456"), "123456");
  assert.equal(normalizeBsb("123456"), "123456");
  assert.equal(normalizeBsb(" 123 456 "), "123456");
});

test("normalizeBsb rejects the wrong number of digits", () => {
  assert.throws(() => normalizeBsb("12345"), /6 digits/);
  assert.throws(() => normalizeBsb("1234567"), /6 digits/);
  assert.throws(() => normalizeBsb(""), /6 digits/);
});

test("formatBsb renders stored digits as XXX-XXX", () => {
  assert.equal(formatBsb("123456"), "123-456");
});

test("assertValidAccountNumber accepts 4-10 digit numbers", () => {
  assert.doesNotThrow(() => assertValidAccountNumber("1234"));
  assert.doesNotThrow(() => assertValidAccountNumber("1234567890"));
});

test("assertValidAccountNumber rejects too short, too long, or non-numeric", () => {
  assert.throws(() => assertValidAccountNumber("123"), /4-10 digits/);
  assert.throws(() => assertValidAccountNumber("12345678901"), /4-10 digits/);
  assert.throws(() => assertValidAccountNumber("12a4"), /4-10 digits/);
});
