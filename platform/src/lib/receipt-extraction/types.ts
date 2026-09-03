// Provider-agnostic OCR/extraction boundary -- swapping providers means
// adding one new file implementing this interface and changing the
// export in index.ts, nothing else.
//
// extract() itself never writes anything, only reads and reports.
// uploadReceiptAction writes a real LineItem automatically when a result
// has both a merchant and a valid amount (a deliberate reversal of this
// module's original "OCR never writes without confirmation" rule); a
// result missing either field is never partially acted on.

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
