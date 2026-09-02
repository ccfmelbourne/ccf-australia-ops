import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReceiptProcessingCard, ReceiptCard } from "@/components/requests/ReceiptCard";

// The fuller assembled view -- drag-and-drop zone plus a mixed grid of
// cards -- as it actually looks together in ReceiptManager.tsx, rather
// than each state in isolation (see Components/FileUpload for that). The
// drop zone below is a static visual copy for documentation purposes;
// it isn't wired to real drag/drop handlers here.
function ReceiptUploadPattern() {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipts</h2>
        <p className="mt-1 text-sm text-slate-600">Upload your official receipts</p>
        <p className="text-xs text-slate-500">PDF, JPEG, PNG, or HEIC · Maximum 10 MB each</p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-slate-300 p-6 text-center">
        <span aria-hidden className="text-2xl text-slate-400">
          ↑
        </span>
        <p className="text-sm font-medium text-slate-700">Drag &amp; drop receipts</p>
        <p className="text-xs text-slate-500">or</p>
        <button
          type="button"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Upload receipts
        </button>
        <p className="text-xs text-slate-500">You can upload multiple receipts</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded receipts</p>
        <div className="grid grid-cols-2 gap-3">
          <ReceiptProcessingCard filename="parking-receipt.pdf" status="scanning" />
          <ReceiptCard
            receipt={{
              id: "1",
              filename: "taxi-receipt.jpg",
              uploadedAt: new Date().toISOString(),
              viewUrl: "#",
              extractedMerchant: "Silver Top Taxis",
              extractedAmount: "45.20",
              scannedAt: new Date().toISOString(),
            }}
          />
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof ReceiptUploadPattern> = {
  title: "Patterns/ReceiptUpload",
  component: ReceiptUploadPattern,
};
export default meta;

type Story = StoryObj<typeof ReceiptUploadPattern>;

export const Default: Story = {};
