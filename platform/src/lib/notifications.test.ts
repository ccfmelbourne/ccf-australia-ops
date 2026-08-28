import test from "node:test";
import assert from "node:assert/strict";
import { buildStatusChangeEmail } from "./notifications.ts";
import type { FinanceStatus } from "./status-transitions.ts";

test("buildStatusChangeEmail includes the voucher, amount, and human-readable status", () => {
  const { subject, text } = buildStatusChangeEmail({
    requesterEmail: "john.smith@example.org",
    requesterName: "John Smith",
    voucherNo: "DV-2026-SEED-001",
    totalAmount: "245.80",
    toStatus: "NEEDS_CLARIFICATION",
  });

  assert.match(subject, /DV-2026-SEED-001/);
  assert.match(subject, /Needs Clarification/);
  assert.match(text, /Hi John Smith,/);
  assert.match(text, /DV-2026-SEED-001 \(\$245\.80\) is now: Needs Clarification\./);
});

test("buildStatusChangeEmail uses the label matching each Finance status", () => {
  const cases: Array<[FinanceStatus, string]> = [
    ["READY_FOR_PROCESSING", "Ready for Processing"],
    ["PROCESSING", "Processing"],
    ["PROCESSED", "Processed"],
    ["REJECTED_RETURNED", "Rejected / Returned"],
  ];

  for (const [toStatus, label] of cases) {
    const { subject } = buildStatusChangeEmail({
      requesterEmail: "john.smith@example.org",
      requesterName: "John Smith",
      voucherNo: "DV-2026-SEED-001",
      totalAmount: "245.80",
      toStatus,
    });
    assert.ok(subject.includes(label), `expected subject to include "${label}" for ${toStatus}`);
  }
});
