"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAndScanReceiptAction, removeReceiptAction } from "@/app/requests/actions";
import { ErrorBanner } from "@/components/ErrorBanner";
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
}: {
  requestId: string;
  receipts: DraftReceiptView[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState<ProcessingFile[]>([]);
  // Inline error state, not a toast -- ReceiptManager always renders inside
  // a native <dialog> (RequestDrawer.tsx), which the browser promotes to
  // the "top layer" the instant it's opened via showModal(). Anything in
  // the top layer renders above *all* regular-positioned content
  // regardless of z-index, so a toast fired while the dialog is open would
  // render behind it -- invisible to the user. Inline text inside the
  // dialog's own DOM doesn't have this problem.
  const [error, setError] = useState<string | null>(null);

  // Each file is uploaded and scanned in one combined call
  // (uploadAndScanReceiptAction), processed sequentially rather than all
  // at once -- a clean, ordered per-file status instead of a burst of
  // concurrent uploads racing each other. router.refresh() after each one
  // so cards appear one by one as they finish. The "scanning" label swap
  // is purely cosmetic (there's no real per-phase signal from one combined
  // server call) -- it just gives a sense of progress rather than a
  // single opaque "working..." the whole time.
  async function processFiles(files: File[]) {
    setError(null);
    for (const file of files) {
      const tempId = `${file.name}-${Date.now()}-${Math.random()}`;
      setProcessing((prev) => [...prev, { tempId, filename: file.name, status: "uploading" }]);
      const scanningTimer = setTimeout(() => {
        setProcessing((prev) =>
          prev.map((p) => (p.tempId === tempId ? { ...p, status: "scanning" } : p)),
        );
      }, 700);

      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadAndScanReceiptAction(requestId, formData);

      clearTimeout(scanningTimer);
      setProcessing((prev) => prev.filter((p) => p.tempId !== tempId));
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    }
  }

  function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;
    startTransition(() => processFiles(files));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    startTransition(() => processFiles(files));
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
      </div>

      {error && <ErrorBanner message={error} />}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-teal-500 bg-teal-50" : "border-slate-300"
        }`}
      >
        <span aria-hidden className="text-2xl text-slate-400">↑</span>
        <p className="text-sm font-medium text-slate-700">Drag &amp; drop receipts</p>
        <p className="text-xs text-slate-500">or</p>
        {/* The real file input stays functional (keyboard/AT accessible)
            but visually hidden -- the button below triggers it. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleFilesChosen}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Upload receipts
        </button>
        <p className="text-xs text-slate-500">You can upload multiple receipts</p>
      </div>

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
