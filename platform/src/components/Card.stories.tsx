import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-700">Account name</p>
      <p className="text-sm text-slate-500">A self-contained block of fields, like a form section.</p>
    </Card>
  ),
};
