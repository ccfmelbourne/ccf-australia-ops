-- AlterEnum
BEGIN;
CREATE TYPE "MinistryType_new" AS ENUM ('ADMIN', 'EXALT_LIVE_PROD', 'FINANCE', 'NXTGEN', 'PASTORAL_CARE', 'B1G', 'ELEVATE', 'EVENTS_HOST', 'COMMS_MEDIA', 'DGM', 'OCEANA_REGIONAL');
ALTER TABLE "ReimbursementRequest" ALTER COLUMN "ministryType" TYPE "MinistryType_new" USING ("ministryType"::text::"MinistryType_new");
-- NOTE: the auto-generated diff also had an ALTER TABLE "ApproverAssignment"
-- here, but that table doesn't exist yet at this point in the migration
-- (it's created below) -- removed manually, since a brand-new table just
-- gets created directly against the already-renamed enum type moments later.
ALTER TYPE "MinistryType" RENAME TO "MinistryType_old";
ALTER TYPE "MinistryType_new" RENAME TO "MinistryType";
DROP TYPE "public"."MinistryType_old";
COMMIT;

-- CreateTable
CREATE TABLE "ApproverAssignment" (
    "id" TEXT NOT NULL,
    "role" "ApproverRole" NOT NULL,
    "ministryType" "MinistryType",
    "userId" TEXT NOT NULL,

    CONSTRAINT "ApproverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApproverAssignment_role_ministryType_key" ON "ApproverAssignment"("role", "ministryType");

-- AddForeignKey
ALTER TABLE "ApproverAssignment" ADD CONSTRAINT "ApproverAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
