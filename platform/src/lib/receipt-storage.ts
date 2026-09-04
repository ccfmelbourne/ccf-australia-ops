import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible (ADR 0002, using the `oc` Oceania location
// hint — see ADR 0002's "Data residency" note). This uses the AWS SDK's S3
// client pointed at R2's endpoint, so a future migration to real S3 needs
// no code change here, only different env vars/endpoint.

// 4 MB, not the 10 MB this originally allowed -- Vercel Functions have a
// hard, unconfigurable 4.5 MB request payload ceiling, independent of
// next.config.ts's own bodySizeLimit. Leaves headroom under that for
// multipart/form-data overhead.
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
]);

// Pure and directly testable — no network/SDK calls. Virus/malware
// scanning is a separate, not-yet-addressed concern (see spec 0002's open
// questions); this only guards type/size sanity.
export function assertValidReceiptFile(file: { size: number; contentType: string }): void {
  if (file.size <= 0) {
    throw new Error("Receipt file is empty.");
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error(
      `Receipt file is too large (${file.size} bytes) — max ${MAX_RECEIPT_BYTES} bytes.`,
    );
  }
  if (!ALLOWED_CONTENT_TYPES.has(file.contentType)) {
    throw new Error(
      `Unsupported receipt file type "${file.contentType}" — allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}.`,
    );
  }
}

// Walks a PNG's actual chunk structure looking for the acTL (Animation
// Control) chunk, rather than a naive byte-substring search -- a substring
// search could false-positive on compressed pixel data that happens to
// contain the same 4 bytes. Per the APNG spec, acTL must appear before the
// first IDAT, so it's safe to stop looking once IDAT is reached.
function isAnimatedPng(bytes: Buffer): boolean {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return false;
  }
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "acTL") return true;
    if (type === "IDAT") return false;
    offset += 12 + length; // 4 (length) + 4 (type) + length (data) + 4 (crc)
  }
  return false;
}

// A receipt should be one static document -- an animated PNG (multiple
// frames, e.g. from exporting a multi-page PDF to a single animated image
// instead of uploading the PDF itself) plays as a looping animation in any
// browser that opens it, which isn't a usable receipt either way this app
// shows it (the requester/approver's view link, or embedded in the voucher
// PDF). Content-Type alone can't tell an APNG apart from a normal PNG --
// both report "image/png" -- so this inspects the actual bytes. Only
// meaningful for image/png; every other allowed type has no such concept.
export function assertNotAnimatedPng(bytes: Buffer, contentType: string): void {
  if (contentType === "image/png" && isAnimatedPng(bytes)) {
    throw new Error(
      "This PNG is animated (multiple frames) — upload the original PDF or a single static image instead.",
    );
  }
}

// Pure and directly testable. Prefixed by request so a request's receipts
// group together in the bucket; a random component avoids collisions
// between two receipts sharing an original filename.
export function buildReceiptStorageKey(requestId: string, originalFilename: string): string {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `receipts/${requestId}/${randomUUID()}-${safeName}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example.`);
  }
  return value;
}

function getBucketName(): string {
  return requireEnv("R2_BUCKET_NAME");
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const accountId = requireEnv("R2_ACCOUNT_ID");
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export async function uploadReceipt(
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Receipts are not made public — Finance/the requester view them through a
// short-lived signed URL rather than a permanent public link.
export async function getReceiptDownloadUrl(
  storageKey: string,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: storageKey });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function deleteReceipt(storageKey: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: storageKey }));
}

// Fetches the actual file bytes -- used for server-side processing (Google
// Vision OCR, embedding into the voucher PDF/email), not for showing it to
// a browser (that's getReceiptDownloadUrl's job).
export async function downloadReceiptBytes(
  storageKey: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: getBucketName(), Key: storageKey }),
  );
  if (!response.Body) {
    throw new Error(`Receipt ${storageKey} has no content.`);
  }
  const bytes = await response.Body.transformToByteArray();
  return {
    buffer: Buffer.from(bytes),
    contentType: response.ContentType ?? "application/octet-stream",
  };
}
