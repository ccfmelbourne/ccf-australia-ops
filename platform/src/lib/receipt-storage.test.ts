import test from "node:test";
import assert from "node:assert/strict";
import { assertValidReceiptFile, buildReceiptStorageKey } from "./receipt-storage.ts";

test("assertValidReceiptFile accepts a reasonable PDF", () => {
  assert.doesNotThrow(() =>
    assertValidReceiptFile({ size: 1024, contentType: "application/pdf" }),
  );
});

test("assertValidReceiptFile rejects an empty file", () => {
  assert.throws(
    () => assertValidReceiptFile({ size: 0, contentType: "application/pdf" }),
    /empty/,
  );
});

test("assertValidReceiptFile rejects a file over the size limit", () => {
  assert.throws(
    () =>
      assertValidReceiptFile({ size: 11 * 1024 * 1024, contentType: "application/pdf" }),
    /too large/,
  );
});

test("assertValidReceiptFile rejects an unsupported content type", () => {
  assert.throws(
    () => assertValidReceiptFile({ size: 1024, contentType: "application/zip" }),
    /Unsupported receipt file type/,
  );
});

test("buildReceiptStorageKey groups by request and sanitizes the filename", () => {
  const key = buildReceiptStorageKey("req_123", "my receipt (1).pdf");
  assert.match(key, /^receipts\/req_123\/[0-9a-f-]+-my_receipt__1_\.pdf$/);
});

test("buildReceiptStorageKey produces a different key each call", () => {
  const a = buildReceiptStorageKey("req_123", "receipt.pdf");
  const b = buildReceiptStorageKey("req_123", "receipt.pdf");
  assert.notEqual(a, b);
});
