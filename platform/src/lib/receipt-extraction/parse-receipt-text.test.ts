import test from "node:test";
import assert from "node:assert/strict";
import { parseReceiptText } from "./parse-receipt-text.ts";

test("parses a typical supermarket receipt (numeric date, SUBTOTAL + TOTAL + GST lines)", () => {
  const text = `Woolworths
123 Main St
Sydney NSW 2000
ABN 88 000 014 675

14/08/2026

Milk 2L               $4.50
Bread                  $3.20
Eggs 12pk              $8.00

SUBTOTAL              $14.27
GST                    $1.43
TOTAL                 $15.70`;

  const result = parseReceiptText(text);
  assert.equal(result.merchant, "Woolworths");
  assert.equal(result.date, "2026-08-14");
  assert.equal(result.amount, 15.7);
  assert.equal(result.gst, 1.43);
});

test("parses a tax-invoice-style receipt (worded date, Total Due / GST Amount labels)", () => {
  const text = `Bunnings Warehouse
Tax Invoice

14 August 2026

Timber pack            $79.48
GST Amount: $7.95
Total Due: $87.43`;

  const result = parseReceiptText(text);
  assert.equal(result.merchant, "Bunnings Warehouse");
  assert.equal(result.date, "2026-08-14");
  assert.equal(result.amount, 87.43);
  assert.equal(result.gst, 7.95);
});

test("handles a receipt with no GST line", () => {
  const text = `Corner Cafe
01/02/2026
Coffee                  $4.50
TOTAL                   $4.50`;

  const result = parseReceiptText(text);
  assert.equal(result.merchant, "Corner Cafe");
  assert.equal(result.amount, 4.5);
  assert.equal(result.gst, null);
});

test("returns all nulls for unparseable text", () => {
  const result = parseReceiptText("");
  assert.equal(result.merchant, null);
  assert.equal(result.date, null);
  assert.equal(result.amount, null);
  assert.equal(result.gst, null);
});

test("falls back to the largest dollar amount when there's no TOTAL label", () => {
  const text = `Corner Cafe
Coffee   $4.50
Muffin   $6.00`;

  const result = parseReceiptText(text);
  assert.equal(result.amount, 6.0);
});

test("finds GST and TOTAL when Vision OCR reads a whole label column then a whole amount column", () => {
  // A real failure mode found via live testing against the actual Vision
  // API: a wide gap between a right-aligned label column and its amount
  // column can make Vision read the entire label column first ("SUBTOTAL"
  // / "GST" / "TOTAL"), then the entire amount column after it ("$14.27" /
  // "$1.43" / "$15.70"), rather than each label staying next to its own
  // amount -- this is the real raw OCR shape captured from a live test.
  const text = `Woolworths
14/08/2026
Milk 2L
$4.50
SUBTOTAL
GST
TOTAL
$14.27
$1.43
$15.70`;

  const result = parseReceiptText(text);
  assert.equal(result.amount, 15.7);
  assert.equal(result.gst, 1.43);
});

test("pairs a single label immediately followed by its own amount", () => {
  const text = `Corner Cafe
GST
$0.45
TOTAL
$5.00`;

  const result = parseReceiptText(text);
  assert.equal(result.amount, 5.0);
  assert.equal(result.gst, 0.45);
});
