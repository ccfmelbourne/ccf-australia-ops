import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusTransitionForm } from "./StatusTransitionForm";

const meta: Meta<typeof StatusTransitionForm> = {
  title: "Finance/StatusTransitionForm",
  component: StatusTransitionForm,
};
export default meta;

type Story = StoryObj<typeof StatusTransitionForm>;

const fakeSuccess = async () => {
  await new Promise((r) => setTimeout(r, 400));
  return { ok: true };
};

const fakeFailure = async () => {
  await new Promise((r) => setTimeout(r, 400));
  return { ok: false, error: "Invalid Finance status transition." };
};

export const ReadyForProcessing: Story = {
  args: { requestId: "req_1", currentStatus: "READY_FOR_PROCESSING", onTransition: fakeSuccess },
};
export const Processing: Story = {
  args: { requestId: "req_1", currentStatus: "PROCESSING", onTransition: fakeSuccess },
};
export const Terminal: Story = {
  args: { requestId: "req_1", currentStatus: "PROCESSED", onTransition: fakeSuccess },
};
export const Failure: Story = {
  args: { requestId: "req_1", currentStatus: "READY_FOR_PROCESSING", onTransition: fakeFailure },
};
