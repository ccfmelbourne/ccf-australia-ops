// Shared section-title style -- used for every labeled block inside a
// drawer (Line items, Receipts, Bank details, Approval progress, etc.).
// Bumped from text-xs to text-sm (and slate-500 to slate-600) for more
// presence -- the smaller size read as an afterthought next to the
// content it was labeling.
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{children}</h2>
  );
}
