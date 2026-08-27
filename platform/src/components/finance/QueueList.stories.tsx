import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueueList } from "./QueueList";
import type { QueueItemView } from "@/types/finance";

const meta: Meta<typeof QueueList> = {
  title: "Finance/QueueList",
  component: QueueList,
};
export default meta;

type Story = StoryObj<typeof QueueList>;

const sampleItems: QueueItemView[] = [
  {
    id: "req_1",
    voucherNo: "DV-2026-001",
    requesterName: "John Smith",
    ministryType: "COMMS_MEDIA_DGM",
    totalAmount: "245.80",
    status: "READY_FOR_PROCESSING",
    submittedAt: "2026-08-20T00:00:00.000Z",
  },
  {
    id: "req_2",
    voucherNo: "DV-2026-002",
    requesterName: "Jane Doe",
    ministryType: "OCEANA_REGIONAL",
    totalAmount: "6500.00",
    status: "PROCESSING",
    submittedAt: "2026-08-19T00:00:00.000Z",
  },
  {
    id: "req_3",
    voucherNo: "DV-2026-003",
    requesterName: "Alex Lee",
    ministryType: "B1G",
    totalAmount: "89.50",
    status: "NEEDS_CLARIFICATION",
    submittedAt: "2026-08-18T00:00:00.000Z",
  },
];

export const WithItems: Story = { args: { items: sampleItems } };
export const Empty: Story = { args: { items: [] } };
