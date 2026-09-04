"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadReceiptAction, removeReceiptAction } from "@/app/requests/actions";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FileDropzone } from "@/components/FileDropzone";
import { SectionHeading } from "@/components/SectionHeading";
import { ReceiptProcessingCard, ReceiptCard } from "./ReceiptCard";
import type { DraftReceiptView } from "@/lib/request-data";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.heic";

interface ProcessingFile {
  tempId: string;
  filename: string;
  status: "uploading" | "scanning";
}

export function ReceiptManager({
  requestId,
  receipts,
  onPendingChange,
}: {
  requestId: string;
  receipts: DraftReceiptView[];
  // Reports this component's own isPending upward -- a remove (or upload)
  // is a server round-trip followed by router.refresh(), so until that
  // resolves the `receipts` prop is stale. Without this, removing the
  // only receipt and clicking Continue in that window advanced past the
  // step with none attached (found live).
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState<ProcessingFile[]>([]);

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);
  // Scanning defaults on, but lets a requester opt out per upload rather
  // than removing an auto-created line item afterward when they just
  // wanted to attach a receipt.
  const [scanEnabled, setScanEnabled] = useState(true);
  // Inline error state, not a toast -- ReceiptManager always renders inside
  // a native <dialog>, which the browser promotes to the "top layer" once
  // opened via showModal(). Anything in the top layer renders above all
  // regular content regardless of z-index, so a toast fired while the
  // dialog is open would render behind it, invisible to the user.
  const [error, setError] = useState<string | null>(null);

  // Each file is uploaded (and scanned, unless scanEnabled is off) in one
  // combined call, processed sequentially rather than all at once, with
  // router.refresh() after each so cards appear one by one. The
  // "scanning" label swap is purely cosmetic (no real per-phase signal
  // from one combined server call) and skipped when scanning is off.
  async function processFiles(withIds: { file: File; tempId: string }[]) {
    for (const { file, tempId } of withIds) {
      const scanningTimer = scanEnabled
        ? setTimeout(() => {
            setProcessing((prev) =>
              prev.map((p) => (p.tempId === tempId ? { ...p, status: "scanning" } : p)),
            );
          }, 700)
        : null;

      const formData = new FormData();
      formData.set("file", file);
      formData.set("scan", scanEnabled ? "true" : "false");
      const result = await uploadReceiptAction(requestId, formData);

      if (scanningTimer) clearTimeout(scanningTimer);
      setProcessing((prev) => prev.filter((p) => p.tempId !== tempId));
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    }
  }

  // Adds each file to `processing` synchronously, outside startTransition,
  // before kicking off the upload work inside it -- a state update made
  // inside a transition is itself low-priority, so the "Uploading…" text
  // could lag behind the button's disabled state (found live). Doing the
  // add here first means the loading state shows the instant files are
  // chosen.
  function addFilesAndProcess(files: File[]) {
    setError(null);
    const withIds = files.map((file) => ({
      file,
      tempId: `${file.name}-${Date.now()}-${Math.random()}`,
    }));
    setProcessing((prev) => [
      ...prev,
      ...withIds.map(({ tempId, file }) => ({ tempId, filename: file.name, status: "uploading" as const })),
    ]);
    startTransition(() => processFiles(withIds));
  }

  function handleRemove(receiptId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeReceiptAction(receiptId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <SectionHeading>Receipts</SectionHeading>
        <p className="mt-1 text-sm text-slate-600">Upload your official receipts</p>
        <p className="text-xs text-slate-500">PDF, JPEG, PNG, or HEIC · Maximum 4 MB each</p>
        <p className="text-xs text-red-600">
          Scanning may not always get the item right, edit the item if needed.
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={scanEnabled}
            onChange={(e) => setScanEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Also scan for auto-fill
        </label>
      </div>

      {error && <ErrorBanner message={error} />}

      <FileDropzone
        accept={ACCEPTED_TYPES}
        multiple
        disabled={isPending}
        onFilesSelected={addFilesAndProcess}
        // Files are processed one at a time, so `processing` only ever
        // holds 0 or 1 entry -- reflecting status on the button the
        // requester just clicked, not just in a card that can scroll out
        // of view on a long form (found live: a report of "no loader"
        // during upload, when the card was just out of sight).
        buttonLabel={
          processing.length > 0
            ? processing[0].status === "scanning"
              ? "Scanning…"
              : "Uploading…"
            : "Upload receipts"
        }
        helperText={processing.length > 0 ? processing[0].filename : "You can upload multiple receipts"}
      />

      {(receipts.length > 0 || processing.length > 0) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Uploaded receipts
          </p>
          <div className="grid grid-cols-2 gap-3">
            {processing.map((p) => (
              <ReceiptProcessingCard key={p.tempId} filename={p.filename} status={p.status} />
            ))}
            {receipts.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                onRemove={() => handleRemove(r.id)}
                isRemoving={isPending}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
