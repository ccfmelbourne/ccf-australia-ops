import type { DraftReceiptView } from "@/lib/request-data";

function isImageFilename(filename: string): boolean {
  return /\.(jpe?g|png)$/i.test(filename);
}

// The in-flight card shown while a single file is uploading/scanning --
// extracted out of ReceiptManager so both the real upload flow and
// Storybook (which has no way to actually pause mid-upload) can render
// this exact state.
export function ReceiptProcessingCard({
  filename,
  status,
}: {
  filename: string;
  status: "uploading" | "scanning";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
      <span className="truncate text-xs font-mono text-slate-600">{filename}</span>
      <p className="text-xs text-slate-500">{status === "uploading" ? "Uploading…" : "Scanning receipt…"}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-teal-500" />
      </div>
      {status === "scanning" && (
        <p className="text-xs text-slate-500">Extracting merchant, date, and amount…</p>
      )}
    </div>
  );
}

// A completed receipt's card -- either "Scanned" (merchant/amount found)
// or "Scan incomplete" (attached, but nothing usable was extracted).
// Extracted out of ReceiptManager for the same reason as
// ReceiptProcessingCard above -- one real component, storied directly
// with fixture data instead of a second copy of the same markup.
export function ReceiptCard({
  receipt,
  onRemove,
  isRemoving,
}: {
  receipt: DraftReceiptView;
  onRemove?: () => void;
  isRemoving?: boolean;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-slate-200">
      <div className="flex h-24 items-center justify-center bg-slate-50">
        {isImageFilename(receipt.filename) ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed R2 URL, not a local/optimizable asset
          <img src={receipt.viewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="text-3xl text-slate-400">
            📄
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <span className="truncate font-mono text-xs text-slate-600">{receipt.filename}</span>
        {receipt.scannedAt ? (
          <p className="text-xs text-slate-700">
            {receipt.extractedMerchant}
            {receipt.extractedItem ? ` | ${receipt.extractedItem}` : ""} ·{" "}
            <span className="font-mono font-semibold">${receipt.extractedAmount}</span>
            <br />
            <span className="font-medium text-teal-700">✓ Scanned</span>
          </p>
        ) : (
          <p className="text-xs text-slate-500">Scan incomplete — add manually</p>
        )}
        <div className="flex gap-3 pt-1 text-xs">
          <a
            href={receipt.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="-m-1 p-1 text-teal-700 hover:underline"
          >
            View
          </a>
          {onRemove && (
            <button
              type="button"
              disabled={isRemoving}
              onClick={onRemove}
              className="-m-1 p-1 text-red-600 hover:underline disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
