import { ImageAnnotatorClient } from "@google-cloud/vision";
import { parseReceiptText } from "./parse-receipt-text.ts";
import type { ReceiptExtractionResult, ReceiptExtractionService, ReceiptInput } from "./types.ts";

// Vision rejects HEIC despite some docs listing it as supported (confirmed
// live) -- everything else receipt-storage.ts accepts is scannable here.
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);
const FILE_TYPES = new Set(["application/pdf", "image/tiff"]);

// Pure and directly testable -- no network/SDK calls. Mirrors the
// assertValidReceiptFile/assertScannableFileType pattern used elsewhere.
export function assertScannableFileType(contentType: string): void {
  if (!IMAGE_TYPES.has(contentType) && !FILE_TYPES.has(contentType)) {
    throw new Error(
      `Scanning isn't supported for "${contentType}" receipts — add items manually.`,
    );
  }
}

let client: ImageAnnotatorClient | null = null;

function getClient(): ImageAnnotatorClient {
  if (!client) {
    const raw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
    if (!raw) {
      throw new Error("GOOGLE_VISION_CREDENTIALS_JSON is not set. See .env.example.");
    }
    client = new ImageAnnotatorClient({ credentials: JSON.parse(raw) });
  }
  return client;
}

// Vision's synchronous file endpoint (files.annotate / batchAnnotateFiles)
// takes inline base64 content just like the image endpoint does -- gcsSource
// is one option on InputConfig, not a requirement, so this never touches
// Google Cloud Storage. Bytes come from R2 (via the caller's
// downloadReceiptBytes) and go straight to Vision over HTTPS.
async function extractTextFromFile(buffer: Buffer, contentType: string): Promise<string> {
  const [batchResponse] = await getClient().batchAnnotateFiles({
    requests: [
      {
        inputConfig: { content: buffer, mimeType: contentType },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        pages: [1, 2, 3, 4, 5],
      },
    ],
  });
  const pages = batchResponse.responses?.[0]?.responses ?? [];
  return pages.map((page) => page.fullTextAnnotation?.text ?? "").join("\n");
}

async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const [response] = await getClient().documentTextDetection(buffer);
  return response.fullTextAnnotation?.text ?? "";
}

export class GoogleVisionReceiptExtractor implements ReceiptExtractionService {
  async extract({ buffer, contentType }: ReceiptInput): Promise<ReceiptExtractionResult> {
    assertScannableFileType(contentType);
    const rawText = IMAGE_TYPES.has(contentType)
      ? await extractTextFromImage(buffer)
      : await extractTextFromFile(buffer, contentType);
    return { ...parseReceiptText(rawText), rawText };
  }
}
