import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Unlike the other foundations pages, this documents a near-absence: the
// app uses exactly one shadow value, and only on the two things that sit
// above the rest of the page -- native <dialog> drawers/modals. Everything
// else (cards, table rows, the amber return-reason banner) is separated by
// a border instead, never a shadow. That's a real, deliberate distinction,
// not a gap -- shadow implies "floating above," border implies "part of
// the flow," and every non-dialog surface in this app is the latter.
function ShadowSample() {
  return (
    <div className="flex flex-wrap items-start gap-8 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="h-24 w-40 rounded-lg bg-white shadow-xl" />
        <p className="text-xs font-semibold text-slate-700">shadow-xl</p>
        <p className="max-w-[10rem] text-xs text-slate-500">Dialogs and drawers only (RequestDrawer, ApprovalDrawer, submit-confirm)</p>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="h-24 w-40 rounded-md border border-slate-200 bg-white" />
        <p className="text-xs font-semibold text-slate-700">border, no shadow</p>
        <p className="max-w-[10rem] text-xs text-slate-500">Everything else -- cards, table rows, form sections</p>
      </div>
    </div>
  );
}

const meta: Meta<typeof ShadowSample> = {
  title: "Foundations/Shadows",
  component: ShadowSample,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof ShadowSample>;

export const Scale: Story = {};
