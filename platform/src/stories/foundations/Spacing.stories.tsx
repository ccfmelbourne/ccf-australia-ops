import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Documents the spacing scale actually used across the app -- gaps between
// stacked sections/fields, and the touch-target padding trick
// (`-m-1 p-1` / `-m-2 p-2`) added during the accessibility pass to enlarge
// small text-only links without changing their visual size.
const GAPS: { label: string; className: string }[] = [
  { label: "gap-1 (4px) -- tight label + input pairs", className: "gap-1" },
  { label: "gap-2 (8px) -- badge icon + label, card internals", className: "gap-2" },
  { label: "gap-3 (12px) -- action button rows", className: "gap-3" },
  { label: "gap-4 (16px) -- form field stacks", className: "gap-4" },
  { label: "gap-6 (24px) -- drawer section stacks", className: "gap-6" },
  { label: "gap-8 (32px) -- page-level section stacks", className: "gap-8" },
];

function GapSample({ className }: { className: string }) {
  return (
    <div className={`flex ${className}`}>
      <div className="h-6 w-6 rounded bg-teal-600" />
      <div className="h-6 w-6 rounded bg-teal-600" />
      <div className="h-6 w-6 rounded bg-teal-600" />
    </div>
  );
}

function SpacingScale() {
  return (
    <div className="flex flex-col gap-6 p-4">
      {GAPS.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-xs text-slate-500">{g.label}</p>
          <GapSample className={g.className} />
        </div>
      ))}
      <div>
        <p className="mb-2 text-xs text-slate-500">
          Enlarged touch target (-m-1 p-1) -- same visual size, bigger tappable area
        </p>
        <button type="button" className="-m-1 p-1 text-sm text-teal-700 hover:underline">
          Edit
        </button>
      </div>
    </div>
  );
}

const meta: Meta<typeof SpacingScale> = {
  title: "Foundations/Spacing",
  component: SpacingScale,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof SpacingScale>;

export const Scale: Story = {};
