import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, waitFor, expect, fn } from "storybook/test";
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

function DefaultDemo({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<(() => void) | null>(null);
  return (
    <Dialog
      titleId="story-dialog-title"
      title="CCF-20260902-0124"
      badge={<Badge tone="active">Awaiting approval</Badge>}
      onClose={onClose}
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

// Regression coverage for two real bugs: an outside click could dismiss a
// panel accidentally, and every panel rendered flush left despite the
// className saying right-0, because dialog:modal's UA stylesheet sets
// left:0 and nothing cleared it.
export const Default: Story = {
  render: () => <DefaultDemo onClose={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvasElement.ownerDocument.querySelector("dialog.drawer-panel") as HTMLDialogElement;

    await expect(dialog.open).toBe(true);
    // Renders flush against the LEFT edge (x≈0) -- a regression back to
    // the old right-0-only className would move this well to the right.
    await expect(dialog.getBoundingClientRect().x).toBeLessThan(5);

    // closedby="none" opts out of the browser's native light-dismiss.
    // Asserted directly rather than simulating a backdrop click, since the
    // dialog's own top-layer ::backdrop covers the full viewport, making
    // "outside the panel" not a reliably clickable thing in a real browser.
    await expect(dialog.getAttribute("closedby")).toBe("none");

    await userEvent.keyboard("{Escape}");
    await expect(dialog.open).toBe(true);

    // The bottom Close button (closeRef, not the header X) still works.
    await userEvent.click(canvas.getByText("Close", { exact: true }));
    await waitFor(() => expect(dialog.open).toBe(false));
  },
};

function LongContentDemo() {
  const closeRef = useRef<(() => void) | null>(null);
  return (
    <Dialog titleId="story-dialog-long-title" title="Long content" onClose={() => {}} closeRef={closeRef}>
      {Array.from({ length: 20 }, (_, i) => (
        <p key={i} className="text-sm text-slate-600">
          Section {i + 1} -- the header isn&apos;t sticky, so it scrolls out of view on content this
          long, which is why every real panel places a reachable Close button in its action row.
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

// Regression test: RequestDrawer reuses one <Dialog> instance across the
// create -> edit handoff, and a fast close-then-reopen can land as new
// props before the close settles -- an effect keyed on [] alone never
// reopened that later session (found live). resetKey re-runs the effect
// whenever the session changes, even without a remount.
function ResetKeyDemo() {
  const closeRef = useRef<(() => void) | null>(null);
  const [session, setSession] = useState<"first" | "second">("first");
  const [closedCount, setClosedCount] = useState(0);

  return (
    <>
      {/* A sibling, not a child of Dialog -- a closed native <dialog> is
          display:none, which would make a "reopen" trigger inside it
          unclickable the moment it closes. */}
      <button type="button" onClick={() => setSession("second")}>
        Reopen as second session
      </button>
      <Dialog
        titleId="story-dialog-resetkey-title"
        title={session === "first" ? "First session" : "Second session"}
        resetKey={session}
        onClose={() => setClosedCount((c) => c + 1)}
        closeRef={closeRef}
      >
        <p className="text-sm text-slate-600">closed {closedCount} time(s)</p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => closeRef.current?.()}>
            Close (native)
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export const ReopensAcrossResetKeyChange: Story = {
  render: () => <ResetKeyDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvasElement.ownerDocument.querySelector("dialog.drawer-panel") as HTMLDialogElement;
    await expect(dialog.open).toBe(true);

    await userEvent.click(canvas.getByRole("button", { name: "Close (native)" }));
    await waitFor(() => expect(dialog.open).toBe(false));

    // Same underlying instance, new resetKey -- without it, this dialog
    // would stay closed forever.
    await userEvent.click(canvas.getByRole("button", { name: "Reopen as second session" }));
    await waitFor(() => expect(dialog.open).toBe(true));
    await expect(canvas.getByText("Second session")).toBeInTheDocument();
  },
};

// Documents the fix for a real bug: a nested confirmation <dialog>'s
// Cancel made the OUTER dialog's own "close" event fire too, silently
// closing the whole panel (see RequestDrawer.tsx's SubmitConfirmDialog
// comment). Fixed with a plain overlay instead of a second modal.
//
// IMPORTANT LIMITATION: this story's play() does NOT reproduce that
// cascade, even rebuilt with a real nested dialog (tried repeatedly).
// Documents the fix, not proof a regression here would be caught.
function NestedConfirmDemo() {
  const closeRef = useRef<(() => void) | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <Dialog titleId="story-dialog-nested-title" title="Submit reimbursement" onClose={() => {}} closeRef={closeRef}>
      <Button onClick={() => setShowConfirm(true)}>Submit</Button>
      {showConfirm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <p className="text-sm text-slate-900">Are you sure?</p>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export const NestedConfirmationDoesNotCascadeClose: Story = {
  render: () => <NestedConfirmDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvasElement.ownerDocument.querySelector("dialog.drawer-panel") as HTMLDialogElement;

    await userEvent.click(canvas.getByRole("button", { name: "Submit" }));
    await expect(canvas.getByText("Are you sure?")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(canvas.queryByText("Are you sure?")).toBeNull());

    await expect(dialog.open).toBe(true);
  },
};
