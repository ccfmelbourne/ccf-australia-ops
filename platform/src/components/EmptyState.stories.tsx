import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Patterns/EmptyState",
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const NoRequests: Story = {
  args: { message: "No requests yet." },
};

export const NoPendingApprovals: Story = {
  args: { message: "Nothing pending your approval." },
};
