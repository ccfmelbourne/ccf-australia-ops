import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "@/components/EmptyState";

// Documents every EmptyState message actually used in the app -- one
// component, several messages, replacing what used to be an ad-hoc <p>
// duplicated per table (RequestsTable, ApprovalsTable).
const meta: Meta<typeof EmptyState> = {
  title: "Patterns/EmptyStates",
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const NoRequests: Story = {
  args: { message: "No requests yet." },
};

export const NothingPendingApproval: Story = {
  args: { message: "Nothing pending your approval." },
};
