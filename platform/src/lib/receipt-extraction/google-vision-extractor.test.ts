import test from "node:test";
import assert from "node:assert/strict";
import { assertScannableFileType } from "./google-vision-extractor.ts";

test("assertScannableFileType accepts JPEG, PNG, GIF, PDF, and TIFF", () => {
  for (const type of ["image/jpeg", "image/png", "image/gif", "application/pdf", "image/tiff"]) {
    assert.doesNotThrow(() => assertScannableFileType(type));
  }
});

test("assertScannableFileType rejects HEIC", () => {
  assert.throws(() => assertScannableFileType("image/heic"), /Scanning isn't supported/);
});
