-- AlterTable
ALTER TABLE "ReimbursementRequest" ADD COLUMN     "staleReminder3DaySentAt" TIMESTAMP(3),
ADD COLUMN     "staleReminder7DaySentAt" TIMESTAMP(3);
