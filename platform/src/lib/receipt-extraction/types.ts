// Provider-agnostic OCR/extraction boundary. Swapping providers (Google
// Vision -> AWS Textract, or a later AI-based structured extractor) means
// adding one new file implementing this interface and changing the export
// in index.ts -- nothing else in the app changes.
//
// extract() itself never writes anything -- it only reads a receipt and
// returns what it found. What the caller does with the result is a
// separate decision: as of 2026-09-02, uploadAndScanReceiptAction
// (app/requests/actions.ts) writes a real LineItem automatically whenever
// a result has both a merchant and a valid amount, with no human
// confirmation step -- a deliberate, explicitly confirmed reversal of this
// module's original "OCR never writes without confirmation" rule. A
// result missing either field is never partially acted on; the requester
// adds that line item manually instead.

export interface ReceiptInput {
  buffer: Buffer;
  contentType: string;
}

export interface ReceiptExtractionResult {
  merchant: string | null;
  // The product bought, when exactly one product line could be isolated
  // between the merchant and the totals section -- null for multi-item
  // receipts, where guessing a single product name would misrepresent the
  // purchase (see parseItemDescription). Callers combine this with
  // merchant as "<merchant> | <item>" wherever the two are shown together.
  item: string | null;
  date: string | null; // ISO yyyy-mm-dd, if a date could be parsed
  amount: number | null; // total, AUD
  rawText: string;
}

export interface ReceiptExtractionService {
  extract(receipt: ReceiptInput): Promise<ReceiptExtractionResult>;
}
