-- AlterTable
ALTER TABLE "RequiredApproval" ADD COLUMN     "pendingSinceAt" TIMESTAMP(3),
ADD COLUMN     "reminder2DaySentAt" TIMESTAMP(3),
ADD COLUMN     "reminder5DaySentAt" TIMESTAMP(3),
ADD COLUMN     "reminder7DaySentAt" TIMESTAMP(3);
