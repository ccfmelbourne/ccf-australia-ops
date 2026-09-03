import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Dialog } from "./Dialog";
import { Badge } from "./Badge";
import { Button } from "./Button";

// Storybook renders every story in its own isolated canvas, so the
// showModal()-on-mount panel opening automatically (no trigger button
// needed to see it) matches how it actually behaves in the app.
const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Dialog>;

function DefaultDemo() {
  const closeRef = useRef<(() => void) | null>(null);
  return (
    <Dialog
      titleId="story-dialog-title"
      title="CCF-20260902-0124"
      badge={<Badge tone="active">Awaiting approval</Badge>}
      onClose={() => {}}
      closeRef={closeRef}
    >
      <p className="text-sm text-slate-600">
        This is the shared panel shell every drawer in the app uses -- title, an optional badge, a
        header X, and this scrollable content area.
      </p>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => closeRef.current?.()}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}

export const Default: Story = {
  render: () => <DefaultDemo />,
};

function LongContentDemo() {
  const closeRef = useRef<(() => void) | null>(null);
  return (
    <Dialog titleId="story-dialog-long-title" title="Long content" onClose={() => {}} closeRef={closeRef}>
      {Array.from({ length: 20 }, (_, i) => (
        <p key={i} className="text-sm text-slate-600">
          Section {i + 1} -- the header isn&apos;t sticky, so it scrolls out of view on content this
          long. A Close button reachable at the bottom (not just the header X) is why every real
          panel places one alongside its own action row.
        </p>
      ))}
      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={() => closeRef.current?.()}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}

export const LongContent: Story = {
  render: () => <LongContentDemo />,
};
