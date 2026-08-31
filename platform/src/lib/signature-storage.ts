import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Same R2 bucket/credentials as receipt-storage.ts, just a different key
// prefix -- kept as a separate small file (own S3Client setup) rather than
// refactoring that already-tested file to share a client: the duplication
// here is small (~15 lines) and lower-risk than reshaping working code.

const MAX_SIGNATURE_BYTES = 500 * 1024; // 500 KB -- a trimmed canvas PNG is a few KB; this just guards against abuse.

// Pure and directly testable -- no network/SDK calls.
export function assertValidSignatureImage(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new Error("Signature image is empty.");
  }
  if (bytes.length > MAX_SIGNATURE_BYTES) {
    throw new Error(
      `Signature image is too large (${bytes.length} bytes) — max ${MAX_SIGNATURE_BYTES} bytes.`,
    );
  }
}

// Pure and directly testable. Prefixed by approval id so a given approver
// decision's signature groups together in the bucket.
export function buildSignatureStorageKey(approvalId: string): string {
  return `signatures/${approvalId}/${randomUUID()}.png`;
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

export async function uploadSignature(storageKey: string, body: Buffer): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: storageKey,
      Body: body,
      ContentType: "image/png",
    }),
  );
}

// No signed-download-URL equivalent to receipt-storage.ts's
// getReceiptDownloadUrl -- signatures are never shown to a browser
// directly, only fetched server-side for embedding into the voucher PDF.
export async function downloadSignatureBytes(storageKey: string): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: getBucketName(), Key: storageKey }),
  );
  if (!response.Body) {
    throw new Error(`Signature ${storageKey} has no content.`);
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

// Used when a request carrying decided (signed) approvals gets deleted --
// RequiredApproval rows cascade-delete at the DB level, but their R2
// signature objects don't, same as receipts.
export async function deleteSignature(storageKey: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: storageKey }));
}
