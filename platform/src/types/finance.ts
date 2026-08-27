// Plain display types, decoupled from the Prisma-generated types on purpose:
// Storybook stories render these components with static fixture data and
// never import the Prisma client (no DB needed to run Storybook).

import type { FinanceStatus } from "@/lib/status-transitions";

export type { FinanceStatus };

export interface LineItemView {
  id: string;
  description: string;
  amount: string; // formatted, e.g. "245.80"
}

export interface ReceiptView {
  id: string;
  storageKey: string;
  uploadedAt: string; // ISO date
}

export interface ApprovalHistoryEntryView {
  id: string;
  role: "MINISTRY_OVERSEER" | "COS1" | "COS2" | "FINANCE_OVERSEER" | "REGIONAL_DIRECTOR";
  approverName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedAt: string | null; // ISO date
}

export interface QueueItemView {
  id: string;
  voucherNo: string;
  requesterName: string;
  ministryType: string;
  totalAmount: string; // formatted
  status: FinanceStatus;
  submittedAt: string | null; // ISO date
}

export interface RequestDetailView extends QueueItemView {
  requestType: string;
  lineItems: LineItemView[];
  receipts: ReceiptView[];
  approvalHistory: ApprovalHistoryEntryView[];
}
