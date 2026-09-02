import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  args: {
    children: "Label",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "active", "warning", "success", "danger"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {
  args: { tone: "neutral", children: "Draft" },
};

export const Active: Story = {
  args: { tone: "active", children: "In approval" },
};

export const Warning: Story = {
  args: { tone: "warning", children: "Needs clarification" },
};

export const Success: Story = {
  args: { tone: "success", children: "Approved" },
};

export const Danger: Story = {
  args: { tone: "danger", children: "Rejected" },
};

export const WithIcon: Story = {
  args: { tone: "success", icon: "●", children: "Approved" },
};
