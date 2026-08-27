-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('CASH_ADVANCE', 'REIMBURSEMENT', 'LIQUIDATION_OF_CASH_ADVANCE', 'BENEVOLENCE', 'PAYMENT_TO_SUPPLIER', 'STATE_INTERNATIONAL_TRANSFER');

-- CreateEnum
CREATE TYPE "MinistryType" AS ENUM ('ADMIN', 'EXALT_LIVE_PROD', 'FINANCE', 'NXTGEN', 'PASTORAL_CARE', 'B1G', 'ELEVATE', 'EVENTS_HOST', 'COMMS_MEDIA_DGM', 'OCEANA_REGIONAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_APPROVAL', 'APPROVED', 'READY_FOR_PROCESSING', 'NEEDS_CLARIFICATION', 'PROCESSING', 'PROCESSED', 'REJECTED_RETURNED');

-- CreateEnum
CREATE TYPE "ApproverRole" AS ENUM ('MINISTRY_OVERSEER', 'COS1', 'COS2', 'FINANCE_OVERSEER', 'REGIONAL_DIRECTOR');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementRequest" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "ministryType" "MinistryType" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "reimbursementRequestId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "reimbursementRequestId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredApproval" (
    "id" TEXT NOT NULL,
    "reimbursementRequestId" TEXT NOT NULL,
    "role" "ApproverRole" NOT NULL,
    "approverUserId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "comments" TEXT,

    CONSTRAINT "RequiredApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "reimbursementRequestId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementRequest_voucherNo_key" ON "ReimbursementRequest"("voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "RequiredApproval_reimbursementRequestId_role_key" ON "RequiredApproval"("reimbursementRequestId", "role");

-- AddForeignKey
ALTER TABLE "ReimbursementRequest" ADD CONSTRAINT "ReimbursementRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredApproval" ADD CONSTRAINT "RequiredApproval_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredApproval" ADD CONSTRAINT "RequiredApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
