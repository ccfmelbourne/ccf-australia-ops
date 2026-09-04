// Seeds:
//   1. Named approvers + their ApproverAssignment rows (idempotent, runs
//      unconditionally every time -- does NOT depend on the demo request
//      below existing or not).
//   2. One demo, already-approved reimbursement so the Finance-side
//      vertical slice (queue -> detail -> mark status -> audit log) can be
//      exercised without the request-creation/approval flow existing yet.
//
// Run with: node prisma/seed.ts   (or: npm run db:seed)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import type { MinistryType, ApproverRole } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { COS_POOL } from "../src/lib/approval-routing.ts";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Real approver names/emails live in prisma/seed-data.json (gitignored),
// not in source -- see prisma/seed-data.example.json for the shape and
// setup instructions. One named Ministry Overseer per ministry type; COS
// is a single shared, org-wide pool (COS_POOL, approval-routing.ts), not a
// per-ministry slot -- not every Ministry Overseer also holds a COS seat.
interface NamedUser {
  name: string;
  email: string;
}
interface SeedData {
  namedUsers: Record<string, NamedUser>;
  ministryOverseers: Record<MinistryType, string>;
  financeOverseerKey: string;
  regionalDirectorKey: string;
  demoRequest: { ministryOverseerKey: string; cos1Key: string };
}

const seedDataPath = fileURLToPath(new URL("./seed-data.json", import.meta.url));
let seedData: SeedData;
try {
  seedData = JSON.parse(readFileSync(seedDataPath, "utf-8"));
} catch {
  throw new Error(
    `Missing ${seedDataPath}. Copy prisma/seed-data.example.json to prisma/seed-data.json and fill in real approver names/emails (never committed -- see .gitignore).`,
  );
}

const NAMED_USERS = seedData.namedUsers;
type NamedUserKey = keyof typeof NAMED_USERS;
const MINISTRY_OVERSEERS = seedData.ministryOverseers as Record<MinistryType, NamedUserKey>;

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
      // status only set on create -- re-running this script must never
      // silently un-suspend someone an admin deliberately flipped to
      // SUSPENDED via Prisma Studio.
      create: { name, email, status: "ACTIVE" },
    });
  }

  for (const ministryType of Object.keys(MINISTRY_OVERSEERS) as MinistryType[]) {
    const userKey = MINISTRY_OVERSEERS[ministryType];
    await prisma.approverAssignment.upsert({
      where: { role_ministryType: { role: "MINISTRY_OVERSEER", ministryType } },
      update: { userId: users[userKey].id },
      create: { role: "MINISTRY_OVERSEER", ministryType, userId: users[userKey].id },
    });
    // COS1 used to also be auto-assigned to this same person -- no longer:
    // COS1/COS2 are claimable positions (approval-data.ts resolves who's
    // eligible directly from approval-routing.ts's COS_POOL, not from this
    // table). Remove any stale row left over from an earlier correction.
    await prisma.approverAssignment.deleteMany({ where: { role: "COS1", ministryType } });
  }
  // COS1/COS2 are never assigned here at all (org-wide or per-ministry) --
  // remove any stale org-wide rows left over from a brief earlier attempt
  // to pre-seed them (which also briefly had a COS3).
  await prisma.approverAssignment.deleteMany({ where: { role: { in: ["COS1", "COS2"] }, ministryType: null } });

  // upsert's compound-unique `where` can't express ministryType: null (the
  // generated type requires a real MinistryType there even though the
  // column allows null) -- findFirst + create/update instead for these
  // org-wide rows.
  await upsertOrgWideAssignment("FINANCE_OVERSEER", users[seedData.financeOverseerKey as NamedUserKey].id);
  await upsertOrgWideAssignment("REGIONAL_DIRECTOR", users[seedData.regionalDirectorKey as NamedUserKey].id);

  console.log(
    `Seeded approvers: ${Object.keys(NAMED_USERS).length} users, ${Object.keys(MINISTRY_OVERSEERS).length + 2} ApproverAssignment rows (${Object.keys(MINISTRY_OVERSEERS).length} Ministry Overseer, 2 org-wide). ${COS_POOL.length} COS pool members are resolved directly by email, not seeded here.`,
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
      // Was READY_FOR_PROCESSING (a Finance-side status removed from the
      // schema 2026-09-02) -- APPROVED is the closest current equivalent:
      // fully approved, Finance already has the voucher PDF.
      status: "APPROVED",
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
            approverUserId: users[seedData.demoRequest.ministryOverseerKey as NamedUserKey].id,
            status: "APPROVED",
            decidedAt: new Date("2026-08-19"),
          },
          {
            role: "COS1",
            approverUserId: users[seedData.demoRequest.cos1Key as NamedUserKey].id,
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
