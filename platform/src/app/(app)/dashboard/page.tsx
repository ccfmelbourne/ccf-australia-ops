import { redirect } from "next/navigation";
import { getCurrentUserId, getUserProfile } from "@/lib/user-session";
import { getMyRequests } from "@/lib/request-data";
import { REQUEST_TYPE_LABELS } from "@/lib/request-types";
import { StatCard } from "@/components/shell/StatCard";
import { Table } from "@/components/Table";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeading } from "@/components/SectionHeading";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// This renders server-side (Vercel runs in UTC), so the greeting is
// pinned to Australia/Melbourne -- Intl handles the AEST/AEDT switch
// automatically, which a fixed UTC offset wouldn't.
function currentMelbourneHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
}

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const [requests, user] = await Promise.all([getMyRequests(userId), getUserProfile(userId)]);

  // Bucketed into the three tiles the decision-maker's mockup called for --
  // REJECTED_RETURNED isn't one of them, so it's counted in requests but
  // not surfaced as its own stat here (it's still visible in the Recent
  // requests table below, and in full on /requests).
  const draftCount = requests.filter((r) => r.status === "DRAFT").length;
  const pendingCount = requests.filter(
    (r) => r.status === "IN_APPROVAL" || r.status === "NEEDS_CLARIFICATION",
  ).length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;

  // getMyRequests is already ordered createdAt desc -- no extra sort needed.
  const recentRequests = requests.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {greeting(currentMelbourneHour())}
          {user ? `, ${user.name.split(" ")[0]}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-600">Here&apos;s what&apos;s happening with your reimbursements.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Drafts" count={draftCount} />
        <StatCard label="Pending" count={pendingCount} />
        <StatCard label="Approved" count={approvedCount} />
      </div>

      <div>
        <SectionHeading>Recent requests</SectionHeading>
        {recentRequests.length === 0 ? (
          <EmptyState message="No requests yet." />
        ) : (
          <Table className="min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Request</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-6 text-right">Amount</th>
                <th className="py-2 pr-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-mono">{r.voucherNo}</td>
                  <td className="py-2 pr-2">{REQUEST_TYPE_LABELS[r.requestType]}</td>
                  <td className="py-2 pr-6 text-right font-mono">${r.totalAmount}</td>
                  <td className="py-2 pr-2">
                    <RequestStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
