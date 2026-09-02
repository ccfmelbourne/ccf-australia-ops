import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WizardSteps } from "@/components/requests/WizardSteps";
import { ReviewStep } from "@/components/requests/ReviewStep";
import type { DraftRequestView } from "@/lib/request-data";

// The create wizard's step navigator + Review step, together -- its pure,
// presentation-only pieces, each in their own file with no Server Action
// imports. The wizard's actual container (CreateWizard in
// RequestDrawer.tsx) isn't storied directly: its CreateStep sibling fires
// a real create-draft Server Action the instant it mounts, which would
// write a real row to the shared database every time this story loaded --
// and RequestDrawer.tsx also imports every action this app has, which
// would otherwise drag Prisma's full dependency graph into this bundle.
function ReimbursementFormPattern() {
  const data: DraftRequestView = {
    id: "story-fixture",
    voucherNo: "DV-2026-0123",
    requesterName: "Jane Smith",
    requestType: "REIMBURSEMENT",
    ministryType: "PASTORAL_CARE",
    totalAmount: "785.50",
    lineItems: [
      { id: "1", description: "Office supplies", amount: "245.00" },
      { id: "2", description: "Travel", amount: "420.00" },
      { id: "3", description: "Meals", amount: "120.50" },
    ],
    receipts: [
      {
        id: "1",
        filename: "receipt-1.jpg",
        uploadedAt: new Date().toISOString(),
        viewUrl: "#",
        extractedMerchant: "Officeworks",
        extractedAmount: "245.00",
        scannedAt: new Date().toISOString(),
      },
    ],
    bankDetails: { accountName: "Jane Smith", bsb: "123-456", accountNumber: "12345678" },
    returnReason: null,
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <WizardSteps currentStep={4} furthestStep={4} onJump={() => {}} />
      <ReviewStep data={data} />
    </div>
  );
}

const meta: Meta<typeof ReimbursementFormPattern> = {
  title: "Patterns/ReimbursementForm",
  component: ReimbursementFormPattern,
};
export default meta;

type Story = StoryObj<typeof ReimbursementFormPattern>;

export const ReviewBeforeSubmit: Story = {};
