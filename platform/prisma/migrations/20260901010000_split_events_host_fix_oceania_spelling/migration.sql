-- Stale reference-data rows for the ministry values being removed below.
-- Confirmed live (2026-09-01) that no ReimbursementRequest has ever used
-- EVENTS_HOST or OCEANA_REGIONAL -- only ApproverAssignment holds rows
-- against them (auto-seeded MINISTRY_OVERSEER/COS1 pairs), and those are
-- fully reseeded by prisma/seed.ts right after this migration runs. Without
-- this delete, the enum type-swap below fails: EVENTS_HOST/OCEANA_REGIONAL
-- don't exist in the new enum, so the ::text::"MinistryType_new" cast on
-- any row still holding them would error.
BEGIN;
DELETE FROM "ApproverAssignment" WHERE "ministryType" IN ('EVENTS_HOST', 'OCEANA_REGIONAL');

-- AlterEnum
CREATE TYPE "MinistryType_new" AS ENUM ('ADMIN', 'EXALT_LIVE_PROD', 'FINANCE', 'NXTGEN', 'PASTORAL_CARE', 'B1G', 'ELEVATE', 'EVENTS_RETREAT', 'HOST', 'COMMS_MEDIA', 'DGM', 'OCEANIA_REGIONAL');
ALTER TABLE "ReimbursementRequest" ALTER COLUMN "ministryType" TYPE "MinistryType_new" USING ("ministryType"::text::"MinistryType_new");
ALTER TABLE "ApproverAssignment" ALTER COLUMN "ministryType" TYPE "MinistryType_new" USING ("ministryType"::text::"MinistryType_new");
ALTER TYPE "MinistryType" RENAME TO "MinistryType_old";
ALTER TYPE "MinistryType_new" RENAME TO "MinistryType";
DROP TYPE "public"."MinistryType_old";
COMMIT;
