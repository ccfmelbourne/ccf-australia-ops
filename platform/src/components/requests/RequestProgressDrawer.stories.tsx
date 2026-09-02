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
  { role: "MINISTRY_OVERSEER", approverName: "Dexter Santiago", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z", comments: null },
  { role: "COS1", approverName: null, status: "PENDING", decidedAt: null, comments: null },
];

const tier3FullyApproved: RequestProgressApprovalView[] = [
  { role: "COS1", approverName: "Ross Callado", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z", comments: null },
  { role: "COS2", approverName: "Joel Jerez", status: "APPROVED", decidedAt: "2026-08-29T04:30:00.000Z", comments: null },
  { role: "FINANCE_OVERSEER", approverName: "Vamie Pinlac", status: "APPROVED", decidedAt: "2026-08-30T01:00:00.000Z", comments: null },
];

const rejectedPartway: RequestProgressApprovalView[] = [
  { role: "MINISTRY_OVERSEER", approverName: "Dexter Santiago", status: "REJECTED", decidedAt: "2026-08-28T02:00:00.000Z", comments: null },
];

const tier4Waived: RequestProgressApprovalView[] = [
  { role: "COS1", approverName: "Ross Callado", status: "APPROVED", decidedAt: "2026-08-25T02:00:00.000Z", comments: null },
  { role: "COS2", approverName: "Joel Jerez", status: "APPROVED", decidedAt: "2026-08-26T04:30:00.000Z", comments: null },
  { role: "FINANCE_OVERSEER", approverName: "Vamie Pinlac", status: "APPROVED", decidedAt: "2026-08-27T01:00:00.000Z", comments: null },
  { role: "REGIONAL_DIRECTOR", approverName: null, status: "PENDING", decidedAt: null, comments: null },
];

// Dexter submitted his own Comms & Media request -- his own Ministry
// Overseer tier is auto-satisfied at submit time instead of asking him to
// approve his own reimbursement, with an explicit audit comment; COS1
// still requires a genuinely independent decision.
const tier2SelfSubmittedByOverseer: RequestProgressApprovalView[] = [
  {
    role: "MINISTRY_OVERSEER",
    approverName: "Dexter Santiago",
    status: "AUTO_SATISFIED",
    decidedAt: "2026-08-28T02:00:00.000Z",
    comments: "Auto-satisfied: requester is the designated Ministry Overseer for this request.",
  },
  { role: "COS1", approverName: null, status: "PENDING", decidedAt: null, comments: null },
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

export const AutoSatisfiedByRequester: Story = {
  args: {
    approvals: tier2SelfSubmittedByOverseer,
    ministryType: "COMMS_MEDIA",
    regionalDirectorOverrideConfirmedAt: null,
  },
};
