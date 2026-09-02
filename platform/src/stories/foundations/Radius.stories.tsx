import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Documents the corner-radius values actually used across the app -- every
// value that appears in a real component, not the full Tailwind scale.
const RADII: { label: string; className: string; usage: string }[] = [
  { label: "rounded-md", className: "rounded-md", usage: "Buttons, inputs, cards, badges' square siblings -- the default" },
  { label: "rounded-lg", className: "rounded-lg", usage: "Centered modal (submit-confirm dialog)" },
  { label: "rounded-l-lg", className: "rounded-l-lg", usage: "Side drawer panels (only the leading edge is rounded, since the trailing edge meets the viewport edge)" },
  { label: "rounded-full", className: "rounded-full", usage: "Status badges, wizard step pills, avatar-style initials circle, progress bar track" },
];

function RadiusSample({ className }: { className: string }) {
  return <div className={`h-16 w-16 border-2 border-teal-600 bg-teal-50 ${className}`} />;
}

function RadiusScale() {
  return (
    <div className="grid grid-cols-2 gap-6 p-4 sm:grid-cols-4">
      {RADII.map((r) => (
        <div key={r.label} className="flex flex-col items-center gap-2 text-center">
          <RadiusSample className={r.className} />
          <p className="text-xs font-semibold text-slate-700">{r.label}</p>
          <p className="text-xs text-slate-500">{r.usage}</p>
        </div>
      ))}
    </div>
  );
}

const meta: Meta<typeof RadiusScale> = {
  title: "Foundations/Radius",
  component: RadiusScale,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof RadiusScale>;

export const Scale: Story = {};
