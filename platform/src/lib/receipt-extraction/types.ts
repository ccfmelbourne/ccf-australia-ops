// Provider-agnostic OCR/extraction boundary. Swapping providers (Google
// Vision -> AWS Textract, or a later AI-based structured extractor) means
// adding one new file implementing this interface and changing the export
// in index.ts -- nothing else in the app changes.
//
// Every ReceiptExtractionResult field is a *suggestion*: extract() never
// writes to the database. The caller always routes a confirmed value
// through the normal add-line-item flow, same as a manually typed row --
// no OCR result may alter or approve financial data without explicit
// human confirmation.

export interface ReceiptInput {
  buffer: Buffer;
  contentType: string;
}

export interface ReceiptExtractionResult {
  merchant: string | null;
  date: string | null; // ISO yyyy-mm-dd, if a date could be parsed
  amount: number | null; // total, AUD
  gst: number | null;
  rawText: string;
}

export interface ReceiptExtractionService {
  extract(receipt: ReceiptInput): Promise<ReceiptExtractionResult>;
}
