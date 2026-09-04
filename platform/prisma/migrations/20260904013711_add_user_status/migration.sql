-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
-- Every pre-existing User row (named approvers, anyone who already signed
-- in before this migration) is grandfathered in as ACTIVE, since they're
-- already legitimately using the app -- the column's default is switched
-- to SUSPENDED immediately after, for every row created from this point on.
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'SUSPENDED';
