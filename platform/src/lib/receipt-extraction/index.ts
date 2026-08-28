import { GoogleVisionReceiptExtractor } from "./google-vision-extractor.ts";
import type { ReceiptExtractionService } from "./types.ts";

export type {
  ReceiptExtractionResult,
  ReceiptExtractionService,
  ReceiptInput,
} from "./types.ts";

// The swap point: a future AwsTextractReceiptExtractor or
// AnthropicReceiptExtractor (structured-AI enhancement) is a new file
// implementing ReceiptExtractionService plus a one-line change here --
// nothing else in the app needs to change.
export const receiptExtractionService: ReceiptExtractionService = new GoogleVisionReceiptExtractor();
