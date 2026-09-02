import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoneyStat } from "./MoneyStat";

const meta: Meta<typeof MoneyStat> = {
  title: "Components/MoneyDisplay",
  component: MoneyStat,
};
export default meta;

type Story = StoryObj<typeof MoneyStat>;

export const ReimbursementTotal: Story = {
  args: { label: "Total reimbursement", amount: "1,284.50" },
};

export const ApprovalAmount: Story = {
  args: { label: "Total amount", amount: "245.00" },
};

export const LargeAmount: Story = {
  args: { label: "Total reimbursement", amount: "12,450.75" },
};
