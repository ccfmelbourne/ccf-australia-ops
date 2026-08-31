import test from "node:test";
import assert from "node:assert/strict";
import { assertValidReceiptFile, assertNotAnimatedPng, buildReceiptStorageKey } from "./receipt-storage.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, dataLength: number): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(dataLength, 0);
  return Buffer.concat([length, Buffer.from(type, "ascii"), Buffer.alloc(dataLength), Buffer.alloc(4)]);
}

const staticPng = Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", 13), pngChunk("IDAT", 4), pngChunk("IEND", 0)]);

const animatedPng = Buffer.concat([
  PNG_SIGNATURE,
  pngChunk("IHDR", 13),
  pngChunk("acTL", 8),
  pngChunk("fcTL", 26),
  pngChunk("IDAT", 4),
  pngChunk("IEND", 0),
]);

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

test("assertNotAnimatedPng accepts a normal static PNG", () => {
  assert.doesNotThrow(() => assertNotAnimatedPng(staticPng, "image/png"));
});

test("assertNotAnimatedPng rejects a PNG with an acTL (APNG) chunk", () => {
  assert.throws(() => assertNotAnimatedPng(animatedPng, "image/png"), /animated/);
});

test("assertNotAnimatedPng skips non-PNG content types entirely", () => {
  assert.doesNotThrow(() => assertNotAnimatedPng(animatedPng, "image/jpeg"));
});
