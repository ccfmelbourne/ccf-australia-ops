import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RequestStatusBadge } from "./RequestStatusBadge";

const meta: Meta<typeof RequestStatusBadge> = {
  title: "Components/StatusBadge",
  component: RequestStatusBadge,
};
export default meta;

type Story = StoryObj<typeof RequestStatusBadge>;

// One story per real status this app produces (request-types.ts's
// REQUEST_STATUS_META) -- every status pairs an icon with a text label,
// never relying on color alone.
export const Draft: Story = { args: { status: "DRAFT" } };
export const AwaitingApproval: Story = { args: { status: "IN_APPROVAL" } };
export const NeedsChanges: Story = { args: { status: "NEEDS_CLARIFICATION" } };
export const Approved: Story = { args: { status: "APPROVED" } };
export const Rejected: Story = { args: { status: "REJECTED_RETURNED" } };

// Falls back gracefully rather than throwing for old/seeded data or a
// future status this component hasn't been told about yet.
export const UnknownStatus: Story = { args: { status: "SOMETHING_NEW" } };
