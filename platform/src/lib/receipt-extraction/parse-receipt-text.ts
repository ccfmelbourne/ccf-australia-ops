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

export function parseGst(text: string): number | null {
  const lines = text.split("\n");
  const sameLine = findAmountOnSameLine(lines, /\bgst\b/i);
  if (sameLine !== null) return sameLine;
  return pairColumnLabelsWithAmounts(lines).get("gst") ?? null;
}

export function parseReceiptText(text: string): Omit<ReceiptExtractionResult, "rawText"> {
  return {
    merchant: parseMerchant(text),
    date: parseDate(text),
    amount: parseTotalAmount(text),
    gst: parseGst(text),
  };
}
