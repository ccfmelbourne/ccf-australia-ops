import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Documents the actual type scale used across the app -- every size/weight
// combination that appears in a real component, not the full Tailwind
// scale. Body text defaults to Arial/Helvetica (globals.css), not the
// Geist font loaded for <html> -- see that file's comment.
const SAMPLES: { label: string; className: string; example: string }[] = [
  { label: "text-3xl font-bold (MoneyStat hero figure)", className: "text-3xl font-bold tracking-tight", example: "$1,284.50" },
  { label: "text-lg font-bold (drawer/section titles)", className: "text-lg font-bold text-slate-900", example: "DV-2026-0123" },
  { label: "text-base font-bold (celebration panel)", className: "text-base font-bold text-slate-900", example: "Reimbursement approved" },
  { label: "text-sm font-semibold (labels, button text)", className: "text-sm font-semibold text-slate-900", example: "Office supplies" },
  { label: "text-sm (body text)", className: "text-sm text-slate-700", example: "Sign in with your Google account to continue." },
  { label: "text-xs font-semibold uppercase tracking-wide (section eyebrows)", className: "text-xs font-semibold uppercase tracking-wide text-slate-500", example: "Approval progress" },
  { label: "text-xs (muted / secondary text)", className: "text-xs text-slate-500", example: "PDF, JPEG, PNG, or HEIC · Maximum 10 MB each" },
  { label: "font-mono (voucher numbers, amounts, filenames)", className: "font-mono text-sm text-slate-700", example: "DV-2026-0123" },
];

function TypeScale() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {SAMPLES.map((s) => (
        <div key={s.label} className="border-b border-slate-100 pb-3">
          <p className="mb-1 text-xs text-slate-500">{s.label}</p>
          <p className={s.className}>{s.example}</p>
        </div>
      ))}
    </div>
  );
}

const meta: Meta<typeof TypeScale> = {
  title: "Foundations/Typography",
  component: TypeScale,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof TypeScale>;

export const Scale: Story = {};
