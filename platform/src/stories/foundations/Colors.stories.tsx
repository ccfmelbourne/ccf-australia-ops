import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Documents the actual palette this app uses -- not the full Tailwind
// palette, just the specific colors/shades that appear in real components,
// grouped by the meaning they carry (teal = primary/success, amber =
// warning, red = danger, blue = active/in-progress, slate = neutral).
const SWATCHES: { name: string; bg: string; text: string; usage: string }[] = [
  { name: "Teal 600", bg: "bg-teal-600", text: "text-white", usage: "Primary buttons" },
  { name: "Teal 700", bg: "bg-teal-700", text: "text-white", usage: "Primary button hover" },
  { name: "Teal 50 / 700", bg: "bg-teal-50", text: "text-teal-700", usage: "Success badge, scanned label" },
  { name: "Amber 50 / 700", bg: "bg-amber-50", text: "text-amber-700", usage: "Warning badge, request-changes" },
  { name: "Red 50 / 700", bg: "bg-red-50", text: "text-red-700", usage: "Danger badge, error banner" },
  { name: "Blue 50 / 700", bg: "bg-blue-50", text: "text-blue-700", usage: "Active/in-progress badge" },
  { name: "Slate 900", bg: "bg-slate-900", text: "text-white", usage: "Page titles, sign-in button" },
  { name: "Slate 100 / 600", bg: "bg-slate-100", text: "text-slate-600", usage: "Neutral badge" },
  { name: "Slate 500", bg: "bg-white", text: "text-slate-500", usage: "Muted body text (AA-compliant minimum)" },
  { name: "Slate 200", bg: "bg-white", text: "text-slate-200", usage: "Borders, dividers (as border, not text)" },
];

function ColorPalette() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
      {SWATCHES.map((s) => (
        <div key={s.name} className="flex flex-col overflow-hidden rounded-md border border-slate-200">
          <div className={`flex h-16 items-center justify-center text-sm font-semibold ${s.bg} ${s.text}`}>
            {s.name}
          </div>
          <p className="p-2 text-xs text-slate-600">{s.usage}</p>
        </div>
      ))}
    </div>
  );
}

const meta: Meta<typeof ColorPalette> = {
  title: "Foundations/Colors",
  component: ColorPalette,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof ColorPalette>;

export const Palette: Story = {};
