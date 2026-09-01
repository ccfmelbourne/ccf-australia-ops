-- Vestigial Finance-processing statuses are being removed below (nothing
-- has ever transitioned a request into them since Finance retired from the
-- app). Only one live row uses one of them -- the seeded demo request,
-- READY_FOR_PROCESSING -- remapped to its closest current equivalent
-- (fully approved, Finance already has the voucher PDF) before the enum
-- type-swap, since the cast below would otherwise fail on it.
BEGIN;
UPDATE "ReimbursementRequest" SET "status" = 'APPROVED' WHERE "status" = 'READY_FOR_PROCESSING';

-- AlterEnum
CREATE TYPE "RequestStatus_new" AS ENUM ('DRAFT', 'IN_APPROVAL', 'APPROVED', 'NEEDS_CLARIFICATION', 'REJECTED_RETURNED');
ALTER TABLE "public"."ReimbursementRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ReimbursementRequest" ALTER COLUMN "status" TYPE "RequestStatus_new" USING ("status"::text::"RequestStatus_new");
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "public"."RequestStatus_old";
ALTER TABLE "ReimbursementRequest" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;
