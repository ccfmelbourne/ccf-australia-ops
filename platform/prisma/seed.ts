// Seeds:
//   1. Named approvers + their ApproverAssignment rows (idempotent, runs
//      unconditionally every time -- does NOT depend on the demo request
//      below existing or not).
//   2. One demo, already-approved reimbursement so the Finance-side
//      vertical slice (queue -> detail -> mark status -> audit log) can be
//      exercised without the request-creation/approval flow existing yet.
//
// Run with: node prisma/seed.ts   (or: npm run db:seed)

import { PrismaClient } from "../src/generated/prisma/client.ts";
import type { MinistryType, ApproverRole } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Confirmed 2026-08-31 with the decision-maker -- see .ai/WORKLOG.md and
// specs/0002-reimbursement-data-model-api.md for the full reasoning. One
// named approver per ministry type (no COS2 anywhere -- a pre-existing gap
// in the pilot's own reference data, not something new), plus two org-wide
// roles (Finance Overseer, Regional Director).
const NAMED_USERS = {
  ross: { name: "Ross Callado", email: "rosscallado@gmail.com" },
  joel: { name: "Joel Jerez", email: "joel.jmj@gmail.com" },
  robert: { name: "Robert Cruz", email: "nidezcruz@gmail.com" },
  joshua: { name: "Joshua Magalong", email: "joshua.magalong@gmail.com" },
  lawrence: { name: "Lawrence Hernando", email: "slamboyh72@gmail.com" },
  dexter: { name: "Dexter Santiago", email: "dexsans@gmail.com" },
  moriz: { name: "Moriz Manlangit", email: "moriz.manlangit@gmail.com" },
  ryan: { name: "Ptr. Ryan Escobar", email: "ryanescobar@gmail.com" },
  // Not a ministry overseer anymore (Robert Cruz replaced her for B1G),
  // but still one of the 3 fixed named COS for the tier-4 override path --
  // a separate, later slice. Seeded now so the User row already exists.
  vamie: { name: "Vamie Pinlac", email: "vamiebpinlac@gmail.com" },
} as const;

type NamedUserKey = keyof typeof NAMED_USERS;

const MINISTRY_OVERSEERS: Record<MinistryType, NamedUserKey> = {
  ADMIN: "ross",
  EXALT_LIVE_PROD: "ross",
  FINANCE: "joel",
  NXTGEN: "joel",
  PASTORAL_CARE: "joel",
  B1G: "robert",
  ELEVATE: "joshua",
  EVENTS_HOST: "lawrence",
  COMMS_MEDIA: "dexter",
  DGM: "moriz",
  OCEANA_REGIONAL: "ryan",
};

async function upsertOrgWideAssignment(role: ApproverRole, userId: string) {
  const existing = await prisma.approverAssignment.findFirst({
    where: { role, ministryType: null },
  });
  if (existing) {
    await prisma.approverAssignment.update({ where: { id: existing.id }, data: { userId } });
  } else {
    await prisma.approverAssignment.create({ data: { role, ministryType: null, userId } });
  }
}

async function seedApprovers() {
  const users: Record<NamedUserKey, { id: string }> = {} as never;
  for (const key of Object.keys(NAMED_USERS) as NamedUserKey[]) {
    const { name, email } = NAMED_USERS[key];
    users[key] = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: { name, email },
    });
  }

  for (const ministryType of Object.keys(MINISTRY_OVERSEERS) as MinistryType[]) {
    const userKey = MINISTRY_OVERSEERS[ministryType];
    for (const role of ["MINISTRY_OVERSEER", "COS1"] as const) {
      await prisma.approverAssignment.upsert({
        where: { role_ministryType: { role, ministryType } },
        update: { userId: users[userKey].id },
        create: { role, ministryType, userId: users[userKey].id },
      });
    }
  }

  // upsert's compound-unique `where` can't express ministryType: null (the
  // generated type requires a real MinistryType there even though the
  // column allows null) -- findFirst + create/update instead for these two
  // org-wide rows.
  await upsertOrgWideAssignment("FINANCE_OVERSEER", users.joel.id);
  await upsertOrgWideAssignment("REGIONAL_DIRECTOR", users.ryan.id);

  console.log("Seeded approvers: 9 users, 24 ApproverAssignment rows.");
  return users;
}

async function seedDemoRequest(users: Record<NamedUserKey, { id: string }>) {
  const requester = await prisma.user.upsert({
    where: { email: "john.smith@example.org" },
    update: {},
    create: { name: "John Smith", email: "john.smith@example.org" },
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
      ministryType: "COMMS_MEDIA",
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
            role: "MINISTRY_OVERSEER",
            approverUserId: users.dexter.id,
            status: "APPROVED",
            decidedAt: new Date("2026-08-19"),
          },
          {
            role: "COS1",
            approverUserId: users.dexter.id,
            status: "APPROVED",
            decidedAt: new Date("2026-08-19"),
          },
        ],
      },
    },
  });

  console.log("Seeded reimbursement request:", request.voucherNo, request.id);
}

async function main() {
  const users = await seedApprovers();
  await seedDemoRequest(users);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
