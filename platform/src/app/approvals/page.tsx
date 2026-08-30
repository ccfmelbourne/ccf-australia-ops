import { redirect } from "next/navigation";

// Approvals now render on the /requests landing page (above the requests
// table) instead of a separate route. Kept as a redirect rather than
// deleted outright so any existing bookmark/link to /approvals still lands
// somewhere sensible.
export default function ApprovalsPage() {
  redirect("/requests");
}
