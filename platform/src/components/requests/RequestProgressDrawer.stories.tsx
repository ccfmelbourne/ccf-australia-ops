import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApprovalTimeline } from "./RequestProgressDrawer";
import type { RequestProgressApprovalView } from "@/lib/request-data";

const meta: Meta<typeof ApprovalTimeline> = {
  title: "Components/ApprovalTimeline",
  component: ApprovalTimeline,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof ApprovalTimeline>;

const tier2InProgress: RequestProgressApprovalView[] = [
  { role: "MINISTRY_OVERSEER", approverName: "Dexter Santiago", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z" },
  { role: "COS1", approverName: null, status: "PENDING", decidedAt: null },
];

const tier3FullyApproved: RequestProgressApprovalView[] = [
  { role: "COS1", approverName: "Ross Callado", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z" },
  { role: "COS2", approverName: "Joel Jerez", status: "APPROVED", decidedAt: "2026-08-29T04:30:00.000Z" },
  { role: "FINANCE_OVERSEER", approverName: "Vamie Pinlac", status: "APPROVED", decidedAt: "2026-08-30T01:00:00.000Z" },
];

const rejectedPartway: RequestProgressApprovalView[] = [
  { role: "MINISTRY_OVERSEER", approverName: "Dexter Santiago", status: "REJECTED", decidedAt: "2026-08-28T02:00:00.000Z" },
];

const tier4Waived: RequestProgressApprovalView[] = [
  { role: "COS1", approverName: "Ross Callado", status: "APPROVED", decidedAt: "2026-08-25T02:00:00.000Z" },
  { role: "COS2", approverName: "Joel Jerez", status: "APPROVED", decidedAt: "2026-08-26T04:30:00.000Z" },
  { role: "FINANCE_OVERSEER", approverName: "Vamie Pinlac", status: "APPROVED", decidedAt: "2026-08-27T01:00:00.000Z" },
  { role: "REGIONAL_DIRECTOR", approverName: null, status: "PENDING", decidedAt: null },
];

export const InProgress: Story = {
  args: {
    approvals: tier2InProgress,
    ministryType: "PASTORAL_CARE",
    regionalDirectorOverrideConfirmedAt: null,
  },
};

export const FullyApproved: Story = {
  args: {
    approvals: tier3FullyApproved,
    ministryType: "PASTORAL_CARE",
    regionalDirectorOverrideConfirmedAt: null,
  },
};

export const Rejected: Story = {
  args: {
    approvals: rejectedPartway,
    ministryType: "PASTORAL_CARE",
    regionalDirectorOverrideConfirmedAt: null,
  },
};

// Tier-4's Regional Director row can be satisfied via Ross Callado's
// "within budget" committee confirmation instead of a direct decision --
// this row stays genuinely PENDING forever in that case, rendered as
// "Waived" rather than looking stuck.
export const WaivedRegionalDirector: Story = {
  args: {
    approvals: tier4Waived,
    ministryType: "PASTORAL_CARE",
    regionalDirectorOverrideConfirmedAt: "2026-08-28T05:00:00.000Z",
  },
};
