import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert } from "@/components/Alert";

// Documents the two error/warning surfaces in the app: the flat Alert
// banner (a single message -- form validation, a failed action) and the
// richer amber "changes requested"/"rejected" box (RequestDrawer.tsx's
// return-reason banner), which carries a heading plus an actor and
// comment and isn't a fit for Alert's single-message shape -- shown here
// as its own markup rather than forced into the same component.
function ReturnReasonBox({ decision }: { decision: "REJECTED" | "NEEDS_CLARIFICATION" }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-semibold text-amber-800">
        {decision === "REJECTED" ? "Rejected" : "Changes requested"} by Jane Smith
      </p>
      <p className="mt-1 text-amber-700">Please attach the missing receipt before resubmitting.</p>
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/ErrorStates",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const ValidationError: Story = {
  render: () => (
    <div className="max-w-sm">
      <Alert tone="danger">Account numbers don&apos;t match.</Alert>
    </div>
  ),
};

export const ActionBlocked: Story = {
  render: () => (
    <div className="max-w-sm">
      <Alert tone="warning">Please sign to submit.</Alert>
    </div>
  ),
};

export const ChangesRequested: Story = {
  render: () => (
    <div className="max-w-md">
      <ReturnReasonBox decision="NEEDS_CLARIFICATION" />
    </div>
  ),
};

export const RequestRejected: Story = {
  render: () => (
    <div className="max-w-md">
      <ReturnReasonBox decision="REJECTED" />
    </div>
  ),
};
