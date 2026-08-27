import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RequestDetailView } from "./RequestDetailView";
import type { RequestDetailView as RequestDetailViewType } from "@/types/finance";

const meta: Meta<typeof RequestDetailView> = {
  title: "Finance/RequestDetailView",
  component: RequestDetailView,
};
export default meta;

type Story = StoryObj<typeof RequestDetailView>;

const sampleRequest: RequestDetailViewType = {
  id: "req_1",
  voucherNo: "DV-2026-001",
  requesterName: "John Smith",
  requestType: "REIMBURSEMENT",
  ministryType: "COMMS_MEDIA_DGM",
  totalAmount: "245.80",
  status: "READY_FOR_PROCESSING",
  submittedAt: "2026-08-20T00:00:00.000Z",
  lineItems: [
    { id: "li1", description: "Printer paper and toner", amount: "145.80" },
    { id: "li2", description: "Taxi to event venue", amount: "100.00" },
  ],
  receipts: [
    { id: "r1", storageKey: "receipts/req_1/receipt-1.pdf", uploadedAt: "2026-08-19T00:00:00.000Z" },
  ],
  approvalHistory: [
    { id: "a1", role: "COS1", approverName: "Dexter Santiago", status: "APPROVED", decidedAt: "2026-08-19T00:00:00.000Z" },
    { id: "a2", role: "COS2", approverName: "Moriz Manlangit", status: "APPROVED", decidedAt: "2026-08-19T00:00:00.000Z" },
  ],
};

const fakeSuccess = async () => {
  await new Promise((r) => setTimeout(r, 400));
  return { ok: true };
};

export const ReadyForProcessing: Story = {
  args: { request: sampleRequest, onTransition: fakeSuccess },
};
export const Processed: Story = {
  args: { request: { ...sampleRequest, status: "PROCESSED" }, onTransition: fakeSuccess },
};
