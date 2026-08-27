import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "Finance/StatusBadge",
  component: StatusBadge,
};
export default meta;

type Story = StoryObj<typeof StatusBadge>;

export const ReadyForProcessing: Story = { args: { status: "READY_FOR_PROCESSING" } };
export const NeedsClarification: Story = { args: { status: "NEEDS_CLARIFICATION" } };
export const Processing: Story = { args: { status: "PROCESSING" } };
export const Processed: Story = { args: { status: "PROCESSED" } };
export const RejectedReturned: Story = { args: { status: "REJECTED_RETURNED" } };
