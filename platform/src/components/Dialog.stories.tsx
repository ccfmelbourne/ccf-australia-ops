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

// Regression coverage for three real, live-reported bugs, all fixed inside
// this one component: an outside click used to be able to dismiss a panel
// accidentally (found in RequestDrawer, then found again as a gap in
// ApprovalDrawer/RequestProgressDrawer, which hadn't gotten the same fix
// yet); and every panel actually rendered flush against the *left* edge
// despite the app's className saying right-0, because the browser's own
// dialog:modal stylesheet sets left:0 and nothing cleared it -- invisible
// until a differently-positioned element made the mismatch visible.
export const Default: Story = {
  render: () => <DefaultDemo onClose={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = canvasElement.ownerDocument.querySelector("dialog.drawer-panel") as HTMLDialogElement;

    await expect(dialog.open).toBe(true);
    // Renders flush against the LEFT edge -- not just "not off the right
    // edge of the viewport," but at x≈0. A regression back to the old
    // (broken) right-0-only className would move this well to the right.
    await expect(dialog.getBoundingClientRect().x).toBeLessThan(5);

    // closedby="none" is what actually opts a panel out of the browser's
    // own native light-dismiss (an outside click, or Escape) -- not just
    // this file's own JS, since there is none for backdrop clicks here.
    // Asserted directly on the attribute rather than by simulating a real
    // backdrop click: the dialog's own top-layer ::backdrop covers the
    // full viewport above regular content, so any page element placed
    // "outside" the panel to click would itself be covered by that
    // backdrop -- not a reliable thing to click in a real browser.
    await expect(dialog.getAttribute("closedby")).toBe("none");

    // Escape is reliably simulatable (a keyboard event, not a
    // coordinate-dependent click) and must not dismiss it either.
    await userEvent.keyboard("{Escape}");
    await expect(dialog.open).toBe(true);

    // The bottom Close button (closeRef, not the header X, which also
    // matches role "button" name "Close" via its own aria-label) still
    // works.
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

// Regression test for a real, live-reported bug: RequestDrawer
// deliberately reuses one <Dialog> instance across the create -> edit
// handoff instead of remounting it (see Dialog.tsx's own resetKey
// comment) -- a fast close-then-reopen can land as new props on the same
// instance before the close has even visually settled. An effect keyed on
// [] alone only ever calls showModal() once per mount, so that later
// session's dialog silently never opened (found live: the panel
// intermittently just not appearing). resetKey re-runs the effect
// whenever the session actually changes, even without a remount.
function ResetKeyDemo() {
  const closeRef = useRef<(() => void) | null>(null);
  const [session, setSession] = useState<"first" | "second">("first");
  const [closedCount, setClosedCount] = useState(0);

  return (
    <>
      {/* Deliberately a sibling, not a child of Dialog -- a closed native
          <dialog> is display:none by the UA stylesheet, which would make
          a "reopen" trigger placed inside it inaccessible/unclickable the
          moment it closes. RequestsTable.tsx doesn't have this problem in
          the real app since it's the one deciding whether to render
          RequestDrawer at all, entirely outside the dialog itself. */}
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
    // would silently stay closed forever.
    await userEvent.click(canvas.getByRole("button", { name: "Reopen as second session" }));
    await waitFor(() => expect(dialog.open).toBe(true));
    await expect(canvas.getByText("Second session")).toBeInTheDocument();
  },
};

// Documents the fix for a real, live-reported bug: the submit-
// confirmation popup used to be a second, nested native <dialog> stacked
// on top of this one via showModal(). Closing it made the OUTER dialog's
// own native "close" event fire too, silently closing the whole panel --
// traced conclusively to a genuine browser behavior in the modal-dialog
// stack (an instrumented .close() and a stack trace showed nothing ever
// called it on the outer dialog, see RequestDrawer.tsx's
// SubmitConfirmDialog comment for the full account). Fixed by making the
// confirmation a plain overlay instead of a second competing modal.
//
// This story's own play() does NOT reproduce that cascade, even when
// deliberately rebuilt with a real nested <dialog>+showModal() in place
// of the overlay (tried directly, consistently, across repeated runs) --
// whatever made it reproducible in the real app evidently depends on
// more of RequestDrawer's actual structure than this isolated shape
// captures, not just "two native dialogs, one nested in the other." So
// treat this as documentation of the *fix* (proving the current, correct
// pattern behaves as expected), not as proof a regression back to a
// nested dialog would be caught here -- it might not be.
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
