import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileDropzone } from "./FileDropzone";

const meta: Meta<typeof FileDropzone> = {
  title: "Components/FileDropzone",
  component: FileDropzone,
  args: {
    accept: ".pdf,.jpg,.jpeg,.png,.heic",
    multiple: true,
    buttonLabel: "Upload receipts",
    helperText: "You can upload multiple receipts",
    onFilesSelected: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof FileDropzone>;

export const Default: Story = {};

export const Uploading: Story = {
  args: { disabled: true, buttonLabel: "Uploading…", helperText: "taxi-receipt.jpg" },
};

export const SingleFile: Story = {
  args: { multiple: false, buttonLabel: "Upload signature", helperText: undefined },
};
