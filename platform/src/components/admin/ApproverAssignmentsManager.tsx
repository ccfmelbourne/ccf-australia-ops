"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setApproverAssignmentAction } from "@/app/admin/actions";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { SectionHeading } from "@/components/SectionHeading";
import { Table } from "@/components/Table";
import { SortHeader } from "@/components/admin/SortHeader";
import { MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { APPROVER_ROLE_LABELS } from "@/lib/approval-routing";
import type { AdminAssignmentView, AdminUserView } from "@/lib/admin-data";

type SortColumn = "role" | "holder";

// COS1/COS2 are deliberately not editable here -- they're claimable
// positions resolved from COS_POOL_EMAILS (approval-routing.ts), not
// ApproverAssignment rows; changing who's in that pool is still an env
// var change, not something this page manages.
export function ApproverAssignmentsManager({
  assignments,
  users,
}: {
  assignments: AdminAssignmentView[];
  users: AdminUserView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" }>({
    column: "role",
    direction: "asc",
  });

  function handleChange(role: AdminAssignmentView["role"], ministryType: string | null, userId: string) {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      const result = await setApproverAssignmentAction(role, ministryType, userId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  // Client-side only, same reasoning as UsersManager -- 14 rows total,
  // already fetched as props.
  const rows = useMemo(() => {
    const withLabels = assignments.map((a) => ({
      ...a,
      label: a.ministryType
        ? `${APPROVER_ROLE_LABELS[a.role]} — ${MINISTRY_TYPE_LABELS[a.ministryType]}`
        : APPROVER_ROLE_LABELS[a.role],
      holderText: a.userName ? `${a.userName} (${a.userEmail})` : "Unassigned",
    }));
    const q = search.trim().toLowerCase();
    const filtered = q
      ? withLabels.filter((a) => a.label.toLowerCase().includes(q) || a.holderText.toLowerCase().includes(q))
      : withLabels;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sort.column === "role" ? a.label.localeCompare(b.label) * dir : a.holderText.localeCompare(b.holderText) * dir,
    );
  }, [assignments, search, sort]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Approver assignments</SectionHeading>
      {error && <ErrorBanner message={error} />}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by role, ministry, or holder…"
        className="max-w-xs"
      />

      <Table>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <SortHeader column="role" label="Role" sort={sort} onSort={handleSort} />
            <SortHeader column="holder" label="Current holder" sort={sort} onSort={handleSort} />
            <th className="py-2">Reassign</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-sm text-slate-500">
                No assignments match &quot;{search}&quot;.
              </td>
            </tr>
          )}
          {rows.map((a) => {
            return (
              <tr key={`${a.role}:${a.ministryType ?? ""}`} className="border-b border-slate-100">
                <td className="py-2 pr-2">{a.label}</td>
                <td className="py-2 pr-2 text-slate-600">
                  {a.userName ? a.holderText : <span className="italic">Unassigned</span>}
                </td>
                <td className="py-2">
                  <select
                    disabled={isPending}
                    value={a.userId ?? ""}
                    onChange={(e) => handleChange(a.role, a.ministryType, e.target.value)}
                    className="w-full max-w-xs rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
                  >
                    <option value="" disabled>
                      Select a user…
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </section>
  );
}
