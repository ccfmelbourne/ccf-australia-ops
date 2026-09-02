import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  args: {
    placeholder: "123-456",
  },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {},
};

export const WithValue: Story = {
  args: { defaultValue: "123-456" },
};

export const Error: Story = {
  args: { error: true, defaultValue: "123" },
};

export const Disabled: Story = {
  args: { defaultValue: "123-456", disabled: true },
};
