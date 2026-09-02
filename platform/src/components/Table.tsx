import type { TableHTMLAttributes } from "react";

// Wraps <table> in the app's standard horizontal-scroll container
// (RequestsTable, LineItemManager) so a wide table never overflows the
// page on a narrow screen instead of squishing text. Callers still supply
// their own thead/tbody and their own min-w-[...] (table width varies per
// caller) -- this only owns the shared shell classes.
export function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className ?? ""}`} {...props}>
        {children}
      </table>
    </div>
  );
}
