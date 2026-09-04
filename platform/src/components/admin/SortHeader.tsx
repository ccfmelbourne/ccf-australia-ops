// A tiny, self-contained sortable <th> button, shared by UsersManager and
// ApproverAssignmentsManager -- generic over the column name so each
// table keeps its own column type instead of a shared enum neither
// table's columns actually match.
export function SortHeader<T extends string>({
  column,
  label,
  sort,
  onSort,
}: {
  column: T;
  label: string;
  sort: { column: T; direction: "asc" | "desc" };
  onSort: (column: T) => void;
}) {
  const active = sort.column === column;
  return (
    <th className="py-2 pr-2">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 hover:text-slate-700 ${active ? "text-slate-700" : ""}`}
      >
        {label}
        {active && <span aria-hidden>{sort.direction === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
