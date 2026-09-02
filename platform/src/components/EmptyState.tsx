// Shared empty-state message -- replaces the plain, ad-hoc <p> text
// previously duplicated in RequestsTable ("No requests yet.") and
// ApprovalsTable ("Nothing pending your approval.").
export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-500">{message}</p>;
}
