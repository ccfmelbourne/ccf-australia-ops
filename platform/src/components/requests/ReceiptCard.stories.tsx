import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ReceiptProcessingCard, ReceiptCard } from "./ReceiptCard";

// Storied under "Components/FileUpload" -- the real component in this app
// is receipt-specific (ReceiptManager.tsx), split into ReceiptProcessingCard
// (in-flight) and ReceiptCard (finished) so each of the seven states this
// upload flow can be in is its own story, matching how ReceiptManager
// actually renders them -- not a reconstruction.
const meta: Meta = {
  title: "Components/FileUpload",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

// Nothing uploaded yet -- ReceiptManager doesn't render a card grid at all
// in this state, just its drag-and-drop zone (storied in full under
// Patterns/ReceiptUpload). Shown here as a plain note for completeness.
export const Empty: Story = {
  render: () => <p className="text-sm text-slate-500">No receipts uploaded yet.</p>,
};

export const Uploading: Story = {
  render: () => (
    <div className="w-64">
      <ReceiptProcessingCard filename="taxi-receipt.jpg" status="uploading" />
    </div>
  ),
};

export const Scanning: Story = {
  render: () => (
    <div className="w-64">
      <ReceiptProcessingCard filename="taxi-receipt.jpg" status="scanning" />
    </div>
  ),
};

export const Extracted: Story = {
  render: () => (
    <div className="w-64">
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
  ),
};

// Attached, but OCR couldn't find enough to act on -- the requester adds
// the line item manually instead (uploadAndScanReceiptAction never
// invents data from an incomplete scan).
export const ScanIncomplete: Story = {
  render: () => (
    <div className="w-64">
      <ReceiptCard
        receipt={{
          id: "2",
          filename: "blurry-receipt.pdf",
          uploadedAt: new Date().toISOString(),
          viewUrl: "#",
          extractedMerchant: null,
          extractedItem: null,
          extractedAmount: null,
          scannedAt: null,
        }}
      />
    </div>
  ),
};

export const Error: Story = {
  render: () => <ErrorBanner message="Something went wrong." />,
};

export const TooLarge: Story = {
  render: () => (
    <ErrorBanner message="Receipt file is too large (12,582,912 bytes) — max 10,485,760 bytes." />
  ),
};

export const UnsupportedFormat: Story = {
  render: () => (
    <ErrorBanner message='Unsupported receipt file type "image/gif" — allowed: PDF, JPEG, PNG, HEIC.' />
  ),
};
