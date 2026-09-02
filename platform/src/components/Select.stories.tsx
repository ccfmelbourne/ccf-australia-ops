import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      <option value="" disabled>
        Select a request type…
      </option>
      <option value="CASH_ADVANCE">Cash Advance</option>
      <option value="REIMBURSEMENT">Reimbursement</option>
    </Select>
  ),
  args: {},
};

export const Error: Story = {
  render: (args) => (
    <Select {...args}>
      <option value="">Select a request type…</option>
      <option value="CASH_ADVANCE">Cash Advance</option>
    </Select>
  ),
  args: { error: true },
};

export const Disabled: Story = {
  render: (args) => (
    <Select {...args}>
      <option value="CASH_ADVANCE">Cash Advance</option>
    </Select>
  ),
  args: { disabled: true, defaultValue: "CASH_ADVANCE" },
};
