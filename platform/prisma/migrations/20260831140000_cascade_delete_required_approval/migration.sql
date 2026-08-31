-- DropForeignKey
ALTER TABLE "RequiredApproval" DROP CONSTRAINT "RequiredApproval_reimbursementRequestId_fkey";

-- AddForeignKey
ALTER TABLE "RequiredApproval" ADD CONSTRAINT "RequiredApproval_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
