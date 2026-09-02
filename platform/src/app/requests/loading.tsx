import { Skeleton } from "@/components/Skeleton";

// Next.js renders this automatically while the page's Server Component
// (several parallel queries -- getMyRequests, getPendingApprovalsForUser,
// etc.) is still resolving, instead of a blank screen. Shaped roughly like
// the two sections that are actually there most of the time (a pending
// approval or two, then the requests table) -- an approximation is enough
// since real content usually replaces it well under a second later.
export default function RequestsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-28" />
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border border-slate-200 p-4"
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
