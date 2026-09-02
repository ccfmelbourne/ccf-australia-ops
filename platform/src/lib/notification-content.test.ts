import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApprovedRequestEmail,
  buildStaleDraftReminderEmail,
  buildNewApprovalNotificationEmail,
  buildPendingApprovalReminderEmail,
} from "./notification-content.ts";
import type { ApprovedRequestDetail } from "./request-data.ts";

const baseDetail: ApprovedRequestDetail = {
  id: "req-1",
  voucherNo: "DV-2026-0001",
  requestType: "REIMBURSEMENT",
  ministryType: "ADMIN",
  totalAmount: "245.80",
  tier: 1,
  submittedAt: "2026-08-31T00:00:00.000Z",
  requesterName: "Jane Requester",
  requesterEmail: "jane@example.org",
  lineItems: [{ description: "Printer paper", amount: "245.80" }],
  bankDetails: { accountName: "Jane Requester", bsb: "123-456", accountNumber: "12345678" },
  receipts: [{ storageKey: "receipts/req-1/abc-receipt.jpg", filename: "receipt.jpg" }],
  approvals: [
    {
      role: "MINISTRY_OVERSEER",
      status: "APPROVED",
      approverName: "Approver One",
      decidedAt: "2026-08-31T00:00:00.000Z",
      signatureStorageKey: "signatures/approval-1/abc.png",
    },
  ],
  approverDirectory: [{ ministryType: "ADMIN", overseerName: "Approver One" }],
  regionalDirectorOverrideConfirmedAt: null,
  requesterSignatureStorageKey: null,
};

test("buildApprovedRequestEmail includes the voucher number, requester, and total", () => {
  const { subject, text } = buildApprovedRequestEmail(baseDetail);
  assert.match(subject, /DV-2026-0001/);
  assert.match(subject, /Approved/);
  assert.match(text, /DV-2026-0001/);
  assert.match(text, /Jane Requester/);
  assert.match(text, /245\.80/);
});

test("buildApprovedRequestEmail includes request type and ministry for quick triage", () => {
  const { text } = buildApprovedRequestEmail(baseDetail);
  assert.match(text, /Reimbursement/);
  assert.match(text, /Admin/);
});

test("buildApprovedRequestEmail never includes bank details", () => {
  const { subject, text } = buildApprovedRequestEmail(baseDetail);
  assert.doesNotMatch(subject, /123-456|12345678/);
  assert.doesNotMatch(text, /123-456|12345678/);
});

test("buildApprovedRequestEmail describes the receipt count correctly", () => {
  const one = buildApprovedRequestEmail(baseDetail);
  assert.match(one.text, /1 receipt is also attached\./);

  const none = buildApprovedRequestEmail({ ...baseDetail, receipts: [] });
  assert.match(none.text, /No receipts were attached\./);

  const many = buildApprovedRequestEmail({
    ...baseDetail,
    receipts: [...baseDetail.receipts, { storageKey: "receipts/req-1/def-2.jpg", filename: "receipt2.jpg" }],
  });
  assert.match(many.text, /2 receipts are also attached\./);
});

test("buildStaleDraftReminderEmail includes the voucher number, category, and amount", () => {
  const { subject, text } = buildStaleDraftReminderEmail({
    voucherNo: "CCF-20260902-0001",
    requestType: "REIMBURSEMENT",
    ministryType: "ADMIN",
    totalAmount: "100.00",
    daysStale: 3,
  });
  assert.match(subject, /CCF-20260902-0001/);
  assert.match(text, /CCF-20260902-0001/);
  assert.match(text, /Reimbursement/);
  assert.match(text, /Admin/);
  assert.match(text, /100\.00/);
});

test("buildStaleDraftReminderEmail's wording distinguishes the 3-day and 7-day tiers", () => {
  const three = buildStaleDraftReminderEmail({
    voucherNo: "CCF-20260902-0001",
    requestType: "REIMBURSEMENT",
    ministryType: "ADMIN",
    totalAmount: "100.00",
    daysStale: 3,
  });
  const seven = buildStaleDraftReminderEmail({
    voucherNo: "CCF-20260902-0001",
    requestType: "REIMBURSEMENT",
    ministryType: "ADMIN",
    totalAmount: "100.00",
    daysStale: 7,
  });
  assert.notEqual(three.text, seven.text);
});

test("buildStaleDraftReminderEmail never includes bank details or other sensitive fields", () => {
  const { subject, text } = buildStaleDraftReminderEmail({
    voucherNo: "CCF-20260902-0001",
    requestType: "REIMBURSEMENT",
    ministryType: "ADMIN",
    totalAmount: "100.00",
    daysStale: 3,
  });
  assert.doesNotMatch(subject, /BSB|account/i);
  assert.doesNotMatch(text, /BSB|account/i);
});

const baseApprovalDetail = {
  voucherNo: "CCF-20260902-0001",
  requestType: "REIMBURSEMENT" as const,
  ministryType: "ADMIN" as const,
  totalAmount: "100.00",
  requesterName: "Jane Requester",
  roleLabel: "Ministry Overseer",
};

test("buildNewApprovalNotificationEmail includes the voucher, requester, and role", () => {
  const { subject, text } = buildNewApprovalNotificationEmail(baseApprovalDetail);
  assert.match(subject, /CCF-20260902-0001/);
  assert.match(text, /CCF-20260902-0001/);
  assert.match(text, /Jane Requester/);
  assert.match(text, /Ministry Overseer/);
  assert.match(text, /100\.00/);
});

test("buildNewApprovalNotificationEmail never includes bank details", () => {
  const { subject, text } = buildNewApprovalNotificationEmail(baseApprovalDetail);
  assert.doesNotMatch(subject, /BSB|account/i);
  assert.doesNotMatch(text, /BSB|account/i);
});

test("buildPendingApprovalReminderEmail includes the days-pending count and role", () => {
  const { subject, text } = buildPendingApprovalReminderEmail({ ...baseApprovalDetail, daysPending: 5 });
  assert.match(subject, /CCF-20260902-0001/);
  assert.match(text, /5 days/);
  assert.match(text, /Ministry Overseer/);
});

test("buildPendingApprovalReminderEmail's wording differs across the 2/5/7-day tiers", () => {
  const two = buildPendingApprovalReminderEmail({ ...baseApprovalDetail, daysPending: 2 });
  const five = buildPendingApprovalReminderEmail({ ...baseApprovalDetail, daysPending: 5 });
  const seven = buildPendingApprovalReminderEmail({ ...baseApprovalDetail, daysPending: 7 });
  assert.notEqual(two.text, five.text);
  assert.notEqual(five.text, seven.text);
});
