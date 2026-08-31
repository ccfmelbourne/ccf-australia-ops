import test from "node:test";
import assert from "node:assert/strict";
import { buildApprovedRequestEmail } from "./notification-content.ts";
import type { ApprovedRequestDetail } from "./request-data.ts";

const baseDetail: ApprovedRequestDetail = {
  id: "req-1",
  voucherNo: "DV-2026-0001",
  requestType: "REIMBURSEMENT",
  ministryType: "ADMIN",
  totalAmount: "245.80",
  tier: 1,
  requesterName: "Jane Requester",
  requesterEmail: "jane@example.org",
  lineItems: [{ description: "Printer paper", amount: "245.80" }],
  bankDetails: { accountName: "Jane Requester", bsb: "123-456", accountNumber: "12345678" },
  receipts: [{ storageKey: "receipts/req-1/abc-receipt.jpg", filename: "receipt.jpg" }],
  approvals: [{ role: "MINISTRY_OVERSEER", approverName: "Approver One", decidedAt: "2026-08-31T00:00:00.000Z" }],
};

test("buildApprovedRequestEmail includes the voucher number, requester, and total", () => {
  const { subject, text } = buildApprovedRequestEmail(baseDetail);
  assert.match(subject, /DV-2026-0001/);
  assert.match(subject, /245\.80/);
  assert.match(text, /DV-2026-0001/);
  assert.match(text, /Jane Requester/);
  assert.match(text, /245\.80/);
});

test("buildApprovedRequestEmail never includes bank details", () => {
  const { subject, text } = buildApprovedRequestEmail(baseDetail);
  assert.doesNotMatch(subject, /123-456|12345678/);
  assert.doesNotMatch(text, /123-456|12345678/);
});

test("buildApprovedRequestEmail pluralizes the receipt count correctly", () => {
  const one = buildApprovedRequestEmail(baseDetail);
  assert.match(one.text, /including 1 receipt\./);

  const none = buildApprovedRequestEmail({ ...baseDetail, receipts: [] });
  assert.match(none.text, /including 0 receipts\./);

  const many = buildApprovedRequestEmail({
    ...baseDetail,
    receipts: [...baseDetail.receipts, { storageKey: "receipts/req-1/def-2.jpg", filename: "receipt2.jpg" }],
  });
  assert.match(many.text, /including 2 receipts\./);
});
