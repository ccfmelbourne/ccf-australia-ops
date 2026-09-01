-- AlterEnum
ALTER TYPE "ApproverRole" ADD VALUE 'COS3';

-- DropForeignKey
ALTER TABLE "OverrideApproval" DROP CONSTRAINT "OverrideApproval_approverUserId_fkey";

-- DropForeignKey
ALTER TABLE "OverrideApproval" DROP CONSTRAINT "OverrideApproval_overrideId_fkey";

-- DropForeignKey
ALTER TABLE "RegionalDirectorOverride" DROP CONSTRAINT "RegionalDirectorOverride_reimbursementRequestId_fkey";

-- DropTable
DROP TABLE "OverrideApproval";

-- DropTable
DROP TABLE "RegionalDirectorOverride";
