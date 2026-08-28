import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible (ADR 0002, using the `oc` Oceania location
// hint — see ADR 0002's "Data residency" note). This uses the AWS SDK's S3
// client pointed at R2's endpoint, so a future migration to real S3 needs
// no code change here, only different env vars/endpoint.

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB
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

// Fetches the actual file bytes -- used for server-side processing (e.g.
// feeding the receipt to Claude for scanning), not for showing it to a
// browser (that's getReceiptDownloadUrl's job).
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
