import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApprovalHistoryList } from "./ApprovalHistoryList";
import type { ApprovalHistoryEntryView } from "@/types/finance";

const meta: Meta<typeof ApprovalHistoryList> = {
  title: "Finance/ApprovalHistoryList",
  component: ApprovalHistoryList,
};
export default meta;

type Story = StoryObj<typeof ApprovalHistoryList>;

const sampleEntries: ApprovalHistoryEntryView[] = [
  {
    id: "a1",
    role: "COS1",
    approverName: "Dexter Santiago",
    status: "APPROVED",
    decidedAt: "2026-08-19T00:00:00.000Z",
  },
  {
    id: "a2",
    role: "COS2",
    approverName: "Moriz Manlangit",
    status: "APPROVED",
    decidedAt: "2026-08-19T00:00:00.000Z",
  },
  {
    id: "a3",
    role: "FINANCE_OVERSEER",
    approverName: null,
    status: "PENDING",
    decidedAt: null,
  },
];

export const WithHistory: Story = { args: { entries: sampleEntries } };
export const Empty: Story = { args: { entries: [] } };
