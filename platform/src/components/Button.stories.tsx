import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: {
    children: "Submit",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger", "warning"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Submit reimbursement" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Reject" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Request changes" },
};

export const Disabled: Story = {
  args: { variant: "primary", children: "Submitting…", disabled: true },
};
