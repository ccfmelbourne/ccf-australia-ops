import test from "node:test";
import assert from "node:assert/strict";
import { assertValidSignatureImage, buildSignatureStorageKey } from "./signature-storage.ts";

test("assertValidSignatureImage accepts a reasonable PNG", () => {
  assert.doesNotThrow(() => assertValidSignatureImage(Buffer.alloc(2048)));
});

test("assertValidSignatureImage rejects an empty buffer", () => {
  assert.throws(() => assertValidSignatureImage(Buffer.alloc(0)), /empty/);
});

test("assertValidSignatureImage rejects a buffer over the size limit", () => {
  assert.throws(
    () => assertValidSignatureImage(Buffer.alloc(501 * 1024)),
    /too large/,
  );
});

test("buildSignatureStorageKey groups by approval id", () => {
  const key = buildSignatureStorageKey("approval_123");
  assert.match(key, /^signatures\/approval_123\/[0-9a-f-]+\.png$/);
});

test("buildSignatureStorageKey produces a different key each call", () => {
  const a = buildSignatureStorageKey("approval_123");
  const b = buildSignatureStorageKey("approval_123");
  assert.notEqual(a, b);
});
