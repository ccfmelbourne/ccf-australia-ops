// Seeds one demo, already-approved reimbursement so the Finance-side
// vertical slice (queue -> detail -> mark status -> audit log) can be
// exercised without the request-creation/approval flow existing yet.
//
// Run with: node prisma/seed.ts   (or: npm run db:seed)

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const requester = await prisma.user.upsert({
    where: { email: "john.smith@example.org" },
    update: {},
    create: { name: "John Smith", email: "john.smith@example.org" },
  });

  const cos1 = await prisma.user.upsert({
    where: { email: "dexter.santiago@example.org" },
    update: {},
    create: { name: "Dexter Santiago", email: "dexter.santiago@example.org" },
  });

  const cos2 = await prisma.user.upsert({
    where: { email: "moriz.manlangit@example.org" },
    update: {},
    create: { name: "Moriz Manlangit", email: "moriz.manlangit@example.org" },
  });

  const existing = await prisma.reimbursementRequest.findUnique({
    where: { voucherNo: "DV-2026-SEED-001" },
  });
  if (existing) {
    console.log("Seed request already exists:", existing.id);
    return;
  }

  const request = await prisma.reimbursementRequest.create({
    data: {
      voucherNo: "DV-2026-SEED-001",
      requestType: "REIMBURSEMENT",
      ministryType: "COMMS_MEDIA_DGM",
      requesterId: requester.id,
      totalAmount: 245.8,
      status: "READY_FOR_PROCESSING",
      submittedAt: new Date("2026-08-20"),
      lineItems: {
        create: [
          { description: "Printer paper and toner", amount: 145.8 },
          { description: "Taxi to event venue", amount: 100.0 },
        ],
      },
      receipts: {
        create: [{ storageKey: "receipts/seed-001/receipt-1.pdf" }],
      },
      requiredApprovals: {
        create: [
          {
            role: "COS1",
            approverUserId: cos1.id,
            status: "APPROVED",
            decidedAt: new Date("2026-08-19"),
          },
          {
            role: "COS2",
            approverUserId: cos2.id,
            status: "APPROVED",
            decidedAt: new Date("2026-08-19"),
          },
        ],
      },
    },
  });

  console.log("Seeded reimbursement request:", request.voucherNo, request.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
