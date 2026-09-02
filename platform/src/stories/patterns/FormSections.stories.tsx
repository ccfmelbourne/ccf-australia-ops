import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SectionHeading } from "@/components/SectionHeading";

// Documents the label -> input -> action shape every form in the app
// uses (BankDetailsManager, LineItemManager's add-item form): a
// SectionHeading above a Card, each field its own label+Input pair, and a
// primary Button pinned to the bottom-left via self-start rather than
// stretched full-width.
function ExampleFormSection() {
  return (
    <div className="max-w-sm">
      <SectionHeading>Bank details for payment</SectionHeading>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="fs-account-name" className="text-sm font-medium text-slate-700">
            Account name
          </label>
          <Input id="fs-account-name" defaultValue="Jane Smith" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="fs-bsb" className="text-sm font-medium text-slate-700">
            BSB
          </label>
          <Input id="fs-bsb" defaultValue="123-456" />
        </div>
        <Button type="submit" className="self-start">
          Save bank details
        </Button>
      </Card>
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/FormSections",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <ExampleFormSection />,
};
