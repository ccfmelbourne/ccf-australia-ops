-- AlterEnum
BEGIN;
CREATE TYPE "ApproverRole_new" AS ENUM ('MINISTRY_OVERSEER', 'COS1', 'COS2', 'FINANCE_OVERSEER', 'REGIONAL_DIRECTOR');
ALTER TABLE "RequiredApproval" ALTER COLUMN "role" TYPE "ApproverRole_new" USING ("role"::text::"ApproverRole_new");
ALTER TABLE "ApproverAssignment" ALTER COLUMN "role" TYPE "ApproverRole_new" USING ("role"::text::"ApproverRole_new");
ALTER TYPE "ApproverRole" RENAME TO "ApproverRole_old";
ALTER TYPE "ApproverRole_new" RENAME TO "ApproverRole";
DROP TYPE "public"."ApproverRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "ReimbursementRequest" ADD COLUMN     "regionalDirectorOverrideConfirmedAt" TIMESTAMP(3);
