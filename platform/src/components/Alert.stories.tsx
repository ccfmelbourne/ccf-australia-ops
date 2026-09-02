import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert } from "./Alert";

const meta: Meta<typeof Alert> = {
  title: "Components/Alert",
  component: Alert,
  args: {
    children: "Something went wrong.",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["danger", "warning"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const Danger: Story = {
  args: { tone: "danger", children: "Something went wrong." },
};

export const Warning: Story = {
  args: { tone: "warning", children: "Please sign to submit." },
};
