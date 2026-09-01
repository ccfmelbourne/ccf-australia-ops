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
//
// Corrected 2026-09-01: the original assumption that every Ministry
// Overseer also automatically holds COS1 for their ministry was wrong
// (confirmed via a real approver, Dexter Santiago, reporting he only holds
// COMMS_MEDIA's Ministry Overseer role, not COS1). See
// MINISTRIES_WITH_SAME_PERSON_AS_COS1 below for which ministries actually
// have the same person holding both roles. B1G's overseer also moved back
// to Vamie Pinlac (Robert Cruz removed).
const NAMED_USERS = {
  ross: { name: "Ross Callado", email: "rosscallado@gmail.com" },
  joel: { name: "Joel Jerez", email: "joel.jmj@gmail.com" },
  joshua: { name: "Joshua Magalong", email: "joshua.magalong@gmail.com" },
  lawrence: { name: "Lawrence Hernando", email: "slamboyh72@gmail.com" },
  eland: { name: "Eland Afuang", email: "eland.afuang@gmail.com" },
  dexter: { name: "Dexter Santiago", email: "dexsans@gmail.com" },
  moriz: { name: "Moriz Manlangit", email: "moriz.manlangit@gmail.com" },
  ryan: { name: "Ptr. Ryan Escobar", email: "ryanescobar@gmail.com" },
  // Also the Ministry Overseer + COS for B1G (see MINISTRY_OVERSEERS below)
  // and still one of the 3 fixed named COS for the tier-4 override path --
  // see approval-routing.ts's REGIONAL_DIRECTOR_OVERRIDE_COMMITTEE_EMAILS.
  vamie: { name: "Vamie Pinlac", email: "vamiebpinlac@gmail.com" },
} as const;

type NamedUserKey = keyof typeof NAMED_USERS;

const MINISTRY_OVERSEERS: Record<MinistryType, NamedUserKey> = {
  ADMIN: "ross",
  EXALT_LIVE_PROD: "ross",
  FINANCE: "joel",
  NXTGEN: "joel",
  PASTORAL_CARE: "joel",
  B1G: "vamie",
  ELEVATE: "joshua",
  EVENTS_RETREAT: "eland",
  HOST: "lawrence",
  COMMS_MEDIA: "dexter",
  DGM: "moriz",
  OCEANIA_REGIONAL: "ryan",
};

// Ministries where the same named person holds both Ministry Overseer and
// COS1 -- confirmed 2026-09-01 with the decision-maker, ministry by
// ministry (not assumed automatically like before). Everywhere else, COS1
// is currently unassigned -- the same kind of gap COS2 already has
// everywhere, not something new.
const MINISTRIES_WITH_SAME_PERSON_AS_COS1 = new Set<MinistryType>([
  "ADMIN",
  "EXALT_LIVE_PROD",
  "FINANCE",
  "NXTGEN",
  "PASTORAL_CARE",
  "B1G",
]);

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
    await prisma.approverAssignment.upsert({
      where: { role_ministryType: { role: "MINISTRY_OVERSEER", ministryType } },
      update: { userId: users[userKey].id },
      create: { role: "MINISTRY_OVERSEER", ministryType, userId: users[userKey].id },
    });

    if (MINISTRIES_WITH_SAME_PERSON_AS_COS1.has(ministryType)) {
      await prisma.approverAssignment.upsert({
        where: { role_ministryType: { role: "COS1", ministryType } },
        update: { userId: users[userKey].id },
        create: { role: "COS1", ministryType, userId: users[userKey].id },
      });
    } else {
      // COS1 is a gap for this ministry -- remove any stale row left over
      // from before the 2026-09-01 correction (e.g. Dexter Santiago was
      // previously wrongly seeded as COMMS_MEDIA's COS1 too).
      await prisma.approverAssignment.deleteMany({ where: { role: "COS1", ministryType } });
    }
  }

  // upsert's compound-unique `where` can't express ministryType: null (the
  // generated type requires a real MinistryType there even though the
  // column allows null) -- findFirst + create/update instead for these two
  // org-wide rows.
  await upsertOrgWideAssignment("FINANCE_OVERSEER", users.joel.id);
  await upsertOrgWideAssignment("REGIONAL_DIRECTOR", users.ryan.id);

  console.log(
    "Seeded approvers: 9 users, 20 ApproverAssignment rows (12 Ministry Overseer, 6 COS1, 2 org-wide).",
  );
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
