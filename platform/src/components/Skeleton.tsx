// Single building block for every loading placeholder in the app -- a
// pulsing gray bar shaped (via className) to roughly match whatever real
// content is about to replace it, instead of a generic spinner or a bare
// "Loading..." string.
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`} />;
}
