import { REQUEST_STATUS_META } from "@/lib/request-types";
import { Badge } from "@/components/Badge";

// One consistent visual language for a request's status, used everywhere
// it's shown (dashboard, request list, request detail, approval screen) --
// the label/icon/tone per status live in request-types.ts's
// REQUEST_STATUS_META; the tone-to-classes mapping itself lives in Badge,
// which this builds on.
export function RequestStatusBadge({ status }: { status: string }) {
  // Falls back to the raw status string rather than throwing -- old/seeded
  // data or a future enum value this component hasn't been told about yet
  // should never break the page, just look slightly generic.
  const meta = REQUEST_STATUS_META[status] ?? { label: status, icon: "●" as const, tone: "neutral" as const };
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
