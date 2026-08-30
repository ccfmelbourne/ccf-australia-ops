-- CreateTable
CREATE TABLE "BankDetails" (
    "id" TEXT NOT NULL,
    "reimbursementRequestId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bsb" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankDetails_reimbursementRequestId_key" ON "BankDetails"("reimbursementRequestId");

-- AddForeignKey
ALTER TABLE "BankDetails" ADD CONSTRAINT "BankDetails_reimbursementRequestId_fkey" FOREIGN KEY ("reimbursementRequestId") REFERENCES "ReimbursementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
