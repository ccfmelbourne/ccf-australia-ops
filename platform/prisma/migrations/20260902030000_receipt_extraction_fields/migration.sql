-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "extractedAmount" DECIMAL(12,2),
ADD COLUMN     "extractedMerchant" TEXT,
ADD COLUMN     "scannedAt" TIMESTAMP(3);
