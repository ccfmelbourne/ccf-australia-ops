-- CreateTable
CREATE TABLE "RegionalDirectorOverride" (
    "id" TEXT NOT NULL,
    "reimbursementRequestId" TEXT NOT NULL,
    "withinBudget" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegionalDirectorOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverrideApproval" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "OverrideApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegionalDirectorOverride_reimbursementRequestId_key" ON "RegionalDirectorOverride"("reimbursementRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "OverrideApproval_overrideId_approverUserId_key" ON "OverrideApproval"("overrideId", "approverUserId");

-- AddForeignKey
ALTER TABLE "RegionalDirectorOverride" ADD CONSTRAINT "RegionalDirectorOverride_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverrideApproval" ADD CONSTRAINT "OverrideApproval_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "RegionalDirectorOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverrideApproval" ADD CONSTRAINT "OverrideApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
