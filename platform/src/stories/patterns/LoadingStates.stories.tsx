import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "@/components/Skeleton";
import { ReceiptProcessingCard } from "@/components/requests/ReceiptCard";

// Documents the two loading patterns in the app: Skeleton (shaped bars
// approximating real content, shown automatically by Next.js while a
// Server Component's data is still resolving -- see
// src/app/requests/loading.tsx, which this row shape is lifted from) and
// ReceiptProcessingCard (a real per-file progress indicator for one
// in-flight upload, not a generic skeleton, since its label has to say
// what's actually happening -- uploading vs. scanning -- not just "loading").
function SkeletonRow() {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/LoadingStates",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const PageSkeleton: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-2">
      <SkeletonRow />
      <SkeletonRow />
    </div>
  ),
};

export const ReceiptUploading: Story = {
  render: () => (
    <div className="max-w-xs">
      <ReceiptProcessingCard filename="taxi-receipt.jpg" status="uploading" />
    </div>
  ),
};

export const ReceiptScanning: Story = {
  render: () => (
    <div className="max-w-xs">
      <ReceiptProcessingCard filename="taxi-receipt.jpg" status="scanning" />
    </div>
  ),
};
