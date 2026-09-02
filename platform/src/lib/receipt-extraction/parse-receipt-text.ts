import type { ReceiptExtractionResult } from "./types.ts";

// Pure, deterministic heuristics over raw OCR text -- no AI, no network.
// Receipts vary a lot in layout, so these are best-effort: every field can
// come back null, and the UI shows the result as an editable suggestion,
// never an auto-applied value.

const MONEY = /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/;
const MONEY_ONLY = new RegExp(`^${MONEY.source}$`);

function toNumber(match: string): number {
  return Number(match.replace(/,/g, ""));
}

// Finds a dollar amount on the same line as a label matching labelPattern.
function findAmountOnSameLine(
  lines: string[],
  labelPattern: RegExp,
  excludePattern?: RegExp,
): number | null {
  for (const line of lines) {
    if (!labelPattern.test(line) || excludePattern?.test(line)) continue;
    const match = line.match(MONEY);
    if (match) return toNumber(match[1]);
  }
  return null;
}

function isKnownTotalsLabel(line: string): boolean {
  return /^(sub\s*-?\s*total|gst|total)\s*:?$/i.test(line);
}

// Handles a real Vision OCR quirk found via live testing, worth recording:
// a wide horizontal gap between a right-aligned label column and its
// amount column (common in receipt totals sections) can make Vision read
// the whole label column first, then the whole amount column -- e.g.
// "SUBTOTAL" / "GST" / "TOTAL" as three consecutive lines, followed by
// "$14.27" / "$1.43" / "$15.70" as the next three, rather than each label
// staying next to its own amount. When a contiguous run of known label
// lines is immediately followed by a contiguous run of amount-only lines
// of the same length, pair them positionally (this also covers the
// simpler case of a single label immediately followed by its own amount).
function pairColumnLabelsWithAmounts(lines: string[]): Map<string, number> {
  const trimmed = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  const pairs = new Map<string, number>();
  for (let i = 0; i < trimmed.length; i++) {
    if (!MONEY_ONLY.test(trimmed[i])) continue;
    let moneyEnd = i;
    while (moneyEnd < trimmed.length && MONEY_ONLY.test(trimmed[moneyEnd])) moneyEnd++;
    let labelStart = i;
    while (labelStart > 0 && isKnownTotalsLabel(trimmed[labelStart - 1])) labelStart--;
    const labelBlock = trimmed.slice(labelStart, i);
    const moneyBlock = trimmed.slice(i, moneyEnd);
    if (labelBlock.length > 0 && labelBlock.length === moneyBlock.length) {
      labelBlock.forEach((label, idx) => {
        const match = moneyBlock[idx].match(MONEY);
        if (match) pairs.set(label.toLowerCase().replace(/[\s:-]/g, ""), toNumber(match[1]));
      });
    }
    i = moneyEnd - 1;
  }
  return pairs;
}

function looksLikeDateOrAmountOrAbn(line: string): boolean {
  return (
    parseDate(line) !== null ||
    MONEY.test(line) ||
    /\babn\b/i.test(line) ||
    /^\d[\d\s]{9,}$/.test(line.trim())
  );
}

// First non-blank line that isn't itself a date/amount/ABN line -- receipts
// consistently print the store name at the very top.
export function parseMerchant(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (looksLikeDateOrAmountOrAbn(line)) continue;
    return line;
  }
  return null;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function pad2(n: string): string {
  return n.padStart(2, "0");
}

// Common AU receipt date formats: DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY.
// Returns an ISO yyyy-mm-dd string, or null.
export function parseDate(text: string): string | null {
  const numeric = text.match(/\b([0-3]?\d)[/-]([01]?\d)[/-](\d{4}|\d{2})\b/);
  if (numeric) {
    const [, day, month, yearRaw] = numeric;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const d = Number(day);
    const m = Number(month);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  const worded = text.match(/\b([0-3]?\d)\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (worded) {
    const [, day, monthName, year] = worded;
    const monthKey = monthName.slice(0, 3).toLowerCase();
    const month = MONTHS[monthKey];
    if (month) {
      return `${year}-${month}-${pad2(day)}`;
    }
  }
  return null;
}

// Prefers a line labelled TOTAL (not SUBTOTAL) over the raw largest-number
// fallback, since a subtotal or a line-item price can otherwise outrank it.
export function parseTotalAmount(text: string): number | null {
  const lines = text.split("\n");
  const sameLine = findAmountOnSameLine(lines, /\btotal\b/i, /sub\s*total/i);
  if (sameLine !== null) return sameLine;
  const columnMatch = pairColumnLabelsWithAmounts(lines).get("total");
  if (columnMatch !== undefined) return columnMatch;
  let largest: number | null = null;
  for (const match of text.matchAll(new RegExp(MONEY, "g"))) {
    const value = toNumber(match[1]);
    if (largest === null || value > largest) largest = value;
  }
  return largest;
}

function stripTrailingMoney(line: string): string {
  return line.replace(new RegExp(`${MONEY.source}\\s*$`), "").trim();
}

// A line matching an explicit "Items" section header some POS receipts
// print above the product list (optionally with its own "$" amount-column
// header) -- when present, it's a more reliable start-of-items marker than
// "right after the merchant name", since that gap can otherwise include
// address/phone/ABN/invoice-type boilerplate that isn't part of any item.
const ITEMS_HEADER = /^items?(\s*\$)?$/i;

// Lines that are never part of a product's name, so they're dropped
// entirely rather than folded into the item description: a bare date, ABN,
// or SKU/product code (digits only), a line that's *only* a dollar amount
// (MONEY_ONLY, anchored -- unlike parseMerchant's unanchored MONEY.test,
// this deliberately does NOT flag a line that mixes real product text with
// a trailing price, e.g. "Timber pack   $79.48": that line stays and just
// has its trailing money stripped below), a lone currency symbol or other
// punctuation-only column-header remnant, or a receipt-boilerplate label.
const SKU_ONLY = /^\d{3,}$/;
const SYMBOLS_ONLY = /^[^a-zA-Z0-9]*$/;
const RECEIPT_BOILERPLATE = /^(tax\s+invoice|invoice|receipt|items?|description)\s*:?$/i;

// A circuit breaker for formal invoices with no "Items" header and no
// early totals line (e.g. a SaaS subscription invoice) -- without an
// early boundary, the item block can span almost the whole document
// (address, billing period, subscription ID...) and still resolve to one
// dollar amount, since a real invoice often repeats the same total two or
// three times. Found live: a Renewed Vision invoice produced a ~340
// character "item" that was really most of the invoice. A real product
// name is never this long, so past this length the result is noise, not
// a name -- null (merchant-only) is the safer fallback.
const MAX_ITEM_DESCRIPTION_LENGTH = 100;

function isNoiseLine(line: string): boolean {
  return (
    parseDate(line) !== null ||
    /\babn\b/i.test(line) ||
    /^\d[\d\s]{9,}$/.test(line) ||
    MONEY_ONLY.test(line) ||
    SKU_ONLY.test(line) ||
    SYMBOLS_ONLY.test(line) ||
    RECEIPT_BOILERPLATE.test(line)
  );
}

// The product bought, isolated from the block of lines between the
// merchant (or an explicit "Items" header, when the receipt prints one)
// and the totals section (SUBTOTAL/GST/TOTAL). Real POS receipts often
// wrap a product name across several lines and print its price on a line
// of its own -- not always alongside the name on one line -- so this
// collects every non-noise line in that block rather than requiring a
// single text+price line. Only returned when the block contains exactly
// one distinct dollar amount: a receipt with several items still collapses
// to one line item at the receipt's total (see uploadAndScanReceiptAction),
// so more than one amount means more than one product, and guessing a
// single name out of several would misrepresent the purchase -- null is
// the safer result there, leaving the description as the merchant name
// alone.
export function parseItemDescription(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const merchantIndex = lines.findIndex((l) => !looksLikeDateOrAmountOrAbn(l));
  if (merchantIndex === -1) return null;

  const itemsHeaderIndex = lines.findIndex((l, i) => i > merchantIndex && ITEMS_HEADER.test(l));
  const blockStart = itemsHeaderIndex === -1 ? merchantIndex + 1 : itemsHeaderIndex + 1;
  const totalsIndex = lines.findIndex(
    (l, i) => i >= blockStart && /(sub\s*-?\s*total|gst|total)/i.test(l),
  );
  const block = lines.slice(blockStart, totalsIndex === -1 ? lines.length : totalsIndex);

  const amounts = new Set<number>();
  for (const line of block) {
    for (const match of line.matchAll(new RegExp(MONEY, "g"))) {
      amounts.add(toNumber(match[1]));
    }
  }
  if (amounts.size !== 1) return null;

  const description = block
    .filter((line) => !isNoiseLine(line))
    .map((line) => (MONEY.test(line) ? stripTrailingMoney(line) : line))
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/^\*+\s*/, "")
    .trim();
  if (description.length === 0 || description.length > MAX_ITEM_DESCRIPTION_LENGTH) return null;
  return description;
}

export function parseReceiptText(text: string): Omit<ReceiptExtractionResult, "rawText"> {
  return {
    merchant: parseMerchant(text),
    item: parseItemDescription(text),
    date: parseDate(text),
    amount: parseTotalAmount(text),
  };
}
