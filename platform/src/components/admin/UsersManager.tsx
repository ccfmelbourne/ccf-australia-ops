"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  setUserStatusAction,
  setUserAdminAction,
  deleteUserAction,
  deleteUsersAction,
} from "@/app/admin/actions";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SectionHeading } from "@/components/SectionHeading";
import { Table } from "@/components/Table";
import { SortHeader } from "@/components/admin/SortHeader";
import type { AdminUserView } from "@/lib/admin-data";

type SortColumn = "name" | "email" | "status" | "isAdmin";

// currentUserId scopes the self-suspend/self-de-admin/self-delete guard
// client-side too (hides those controls, and excludes your own row from
// selection) -- the real enforcement is server-side in
// app/admin/actions.ts; this is just so a control isn't visibly offered
// only to fail.
export function UsersManager({ users, currentUserId }: { users: AdminUserView[]; currentUserId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" }>({
    column: "name",
    direction: "asc",
  });

  // Client-side only -- the whole list is already fetched as props (tens
  // of rows, not thousands), so there's no reason to round-trip to the
  // server just to filter/sort what's already in the browser.
  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : users;
    const sorted = [...filtered].sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;
      if (sort.column === "isAdmin") return (Number(a.isAdmin) - Number(b.isAdmin)) * dir;
      return a[sort.column].localeCompare(b[sort.column]) * dir;
    });
    return sorted;
  }, [users, search, sort]);

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  // "Select all" only selects what's currently visible under the active
  // search filter -- a selection made under a different filter isn't
  // silently cleared, just temporarily out of view.
  const selectableUsers = visibleUsers.filter((u) => u.id !== currentUserId);
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((u) => selected.has(u.id));

  function toggleSelected(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(selectableUsers.map((u) => u.id)));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await createUserAction(name, email);
      if (result.ok) {
        setName("");
        setEmail("");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleStatus(userId: string, status: "ACTIVE" | "SUSPENDED") {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await setUserStatusAction(userId, status);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleAdmin(userId: string, isAdmin: boolean) {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await setUserAdminAction(userId, isAdmin);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleDelete(userId: string) {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await deleteUserAction(userId);
      if (result.ok) {
        setConfirmDeleteId(null);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleBulkDelete() {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await deleteUsersAction([...selected]);
      if (!result.ok || !result.result) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setConfirmBulkDelete(false);
      setSelected(new Set());
      const { deletedCount, failed } = result.result;
      setSummary(
        failed.length === 0
          ? `Deleted ${deletedCount} user${deletedCount === 1 ? "" : "s"}.`
          : `Deleted ${deletedCount} user${deletedCount === 1 ? "" : "s"}. ${failed.length} could not be deleted: ${failed.map((f) => `${f.email} (${f.error})`).join("; ")}`,
      );
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Users</SectionHeading>
      {error && <ErrorBanner message={error} />}
      {summary && <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{summary}</p>}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="max-w-xs"
      />

      {selected.size > 0 &&
        (confirmBulkDelete ? (
          <div className="flex items-center gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm">
            <span className="text-red-800">Delete {selected.size} selected user(s)? This can&apos;t be undone.</span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleBulkDelete}
              className="-m-1 p-1 font-semibold text-red-600 hover:underline disabled:opacity-60"
            >
              {isPending ? "Deleting…" : "Yes, delete selected"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmBulkDelete(false)}
              className="-m-1 p-1 text-slate-600 hover:underline disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <Button variant="danger" disabled={isPending} onClick={() => setConfirmBulkDelete(true)}>
              Delete selected ({selected.size})
            </Button>
          </div>
        ))}

      <Table>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-2">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300"
              />
            </th>
            <SortHeader column="name" label="Name" sort={sort} onSort={handleSort} />
            <SortHeader column="email" label="Email" sort={sort} onSort={handleSort} />
            <SortHeader column="status" label="Status" sort={sort} onSort={handleSort} />
            <SortHeader column="isAdmin" label="Admin" sort={sort} onSort={handleSort} />
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {visibleUsers.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-sm text-slate-500">
                No users match &quot;{search}&quot;.
              </td>
            </tr>
          )}
          {visibleUsers.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  {!isSelf && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${u.name}`}
                      checked={selected.has(u.id)}
                      onChange={() => toggleSelected(u.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  )}
                </td>
                <td className="py-2 pr-2">{u.name}</td>
                <td className="py-2 pr-2 font-mono text-xs">{u.email}</td>
                <td className="py-2 pr-2">
                  <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
                </td>
                <td className="py-2 pr-2">{u.isAdmin ? <Badge tone="active">Admin</Badge> : null}</td>
                <td className="py-2 text-right">
                  {!isSelf &&
                    (confirmDeleteId === u.id ? (
                      <span className="flex justify-end items-center gap-3">
                        <span className="text-xs text-slate-600">Delete this user?</span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(u.id)}
                          className="-m-1 p-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                        >
                          {isPending ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmDeleteId(null)}
                          className="-m-1 p-1 text-xs text-slate-600 hover:underline disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-3">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStatus(u.id, u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                          className="-m-1 p-1 text-xs text-teal-700 hover:underline disabled:opacity-60"
                        >
                          {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAdmin(u.id, !u.isAdmin)}
                          className="-m-1 p-1 text-xs text-slate-600 hover:underline disabled:opacity-60"
                        >
                          {u.isAdmin ? "Remove admin" : "Make admin"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmDeleteId(u.id)}
                          className="-m-1 p-1 text-xs text-red-600 hover:underline disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </span>
                    ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700">Add a user</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            className="sm:flex-1"
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email address"
            required
            className="sm:flex-1"
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add user"}
          </Button>
        </div>
      </form>
    </section>
  );
}
