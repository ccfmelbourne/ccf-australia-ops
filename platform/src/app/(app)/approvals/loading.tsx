import { Skeleton } from "@/components/Skeleton";

// Shaped like the pending-approvals list this page renders most of the
// time (the Regional Director override section is rare enough -- almost
// no one ever sees it -- that it's not worth its own skeleton rows).
export default function ApprovalsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-28" />
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 p-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
