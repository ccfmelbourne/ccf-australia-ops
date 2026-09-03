import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileDropzone } from "@/components/FileDropzone";
import { ReceiptProcessingCard, ReceiptCard } from "@/components/requests/ReceiptCard";

// The fuller assembled view -- drag-and-drop zone plus a mixed grid of
// cards -- as it actually looks together in ReceiptManager.tsx, rather
// than each state in isolation (see Components/FileDropzone for that).
// The real FileDropzone is used here (not a static copy), so dropping or
// picking a file really opens the browser's file picker -- selecting one
// won't do anything further, though, since nothing in this story is wired
// to an actual upload.
function ReceiptUploadPattern() {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipts</h2>
        <p className="mt-1 text-sm text-slate-600">Upload your official receipts</p>
        <p className="text-xs text-slate-500">PDF, JPEG, PNG, or HEIC · Maximum 10 MB each</p>
      </div>

      <FileDropzone
        accept=".pdf,.jpg,.jpeg,.png,.heic"
        multiple
        onFilesSelected={() => {}}
        buttonLabel="Upload receipts"
        helperText="You can upload multiple receipts"
      />

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
              extractedItem: "Airport transfer",
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
