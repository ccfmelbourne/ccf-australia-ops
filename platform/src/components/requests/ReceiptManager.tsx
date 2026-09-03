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
  // Reports this component's own isPending upward -- a remove (or an
  // upload) is a server round-trip followed by router.refresh(), and
  // until that resolves, the `receipts` prop is still the pre-mutation
  // value. A wizard step's own Continue button gates on receipts.length
  // alone, so without this, removing the only receipt and clicking
  // Continue in that window advanced to the next step with none attached
  // -- found live. The caller factors this into its own gating instead
  // of this component trying to disable buttons outside itself.
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState<ProcessingFile[]>([]);

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);
  // Scanning defaults on (the previous always-on behavior), but reported
  // as "annoying" when a requester just wants to attach a receipt without
  // it turning into an auto-created line item -- this lets them opt out
  // per upload rather than removing the auto-created item afterward.
  const [scanEnabled, setScanEnabled] = useState(true);
  // Inline error state, not a toast -- ReceiptManager always renders inside
  // a native <dialog> (RequestDrawer.tsx), which the browser promotes to
  // the "top layer" the instant it's opened via showModal(). Anything in
  // the top layer renders above *all* regular-positioned content
  // regardless of z-index, so a toast fired while the dialog is open would
  // render behind it -- invisible to the user. Inline text inside the
  // dialog's own DOM doesn't have this problem.
  const [error, setError] = useState<string | null>(null);

  // Each file is uploaded (and, unless scanEnabled is off, scanned) in one
  // combined call (uploadReceiptAction), processed sequentially rather
  // than all at once -- a clean, ordered per-file status instead of a
  // burst of concurrent uploads racing each other. router.refresh() after
  // each one so cards appear one by one as they finish. The "scanning"
  // label swap is purely cosmetic (there's no real per-phase signal from
  // one combined server call) -- it just gives a sense of progress rather
  // than a single opaque "working..." the whole time, and is skipped
  // entirely when scanning is off, since nothing happens after the upload
  // in that case.
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

  // Adds each file to `processing` synchronously, outside of
  // startTransition, before kicking off the actual upload work inside it
  // -- a state update made *inside* a transition callback is itself
  // treated as low-priority transition work, so the "Uploading…" card
  // and button text could lag well behind the button's disabled state
  // (which comes from useTransition's own isPending and updates
  // instantly) -- found live: the button visibly disabled right away but
  // kept reading "Upload receipts" for a beat. Doing the add here first
  // means the loading state shows the instant files are chosen.
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
        <p className="text-xs text-slate-500">PDF, JPEG, PNG, or HEIC · Maximum 10 MB each</p>
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
        // Files are processed one at a time (processFiles awaits each
        // upload/scan before starting the next), so `processing` only
        // ever holds 0 or 1 entry -- reflecting its status right on the
        // button the requester just clicked, not just in the card further
        // down the form, since that card can be scrolled out of view on a
        // long form and easy to miss (found live: a report of "no
        // loader" during upload -- the card was there, just not where
        // attention already was).
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
