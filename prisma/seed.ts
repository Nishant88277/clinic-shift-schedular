import { readFileSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { importStaffCsv } from "../src/lib/import/staff";
import { importShiftsCsv } from "../src/lib/import/shifts";

const prisma = new PrismaClient();

async function persistReport(
  summary: Awaited<ReturnType<typeof importStaffCsv>>,
  createdById?: string,
) {
  await prisma.importBatch.create({
    data: {
      kind: summary.kind,
      sourceName: summary.sourceName,
      accepted: summary.accepted,
      rejected: summary.rejected,
      merged: summary.merged,
      createdById,
      rows: {
        create: summary.rows.map((r) => ({
          rowNumber: r.rowNumber,
          rawRow: r.rawRow,
          status: r.status,
          reason: r.reason,
          action: r.action,
        })),
      },
    },
  });
}

async function main() {
  console.log("Seeding clinic shift scheduler...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const manager = await prisma.user.upsert({
    where: { email: "manager@clinic.test" },
    update: {},
    create: {
      email: "manager@clinic.test",
      name: "Clinic Manager",
      role: "manager",
      profession: null,
      passwordHash,
    },
  });

  const dataDir = path.join(process.cwd(), "data");
  const staffCsv = readFileSync(path.join(dataDir, "staff.csv"), "utf8");
  const shiftsCsv = readFileSync(path.join(dataDir, "shifts.csv"), "utf8");

  const staffReport = await importStaffCsv(prisma, staffCsv, "seed:staff.csv");
  await persistReport(staffReport, manager.id);
  console.log(
    `Staff import: accepted=${staffReport.accepted} rejected=${staffReport.rejected} merged=${staffReport.merged}`,
  );

  const shiftsReport = await importShiftsCsv(prisma, shiftsCsv, "seed:shifts.csv");
  await persistReport(shiftsReport, manager.id);
  console.log(
    `Shifts import: accepted=${shiftsReport.accepted} rejected=${shiftsReport.rejected} merged=${shiftsReport.merged}`,
  );

  console.log("Seed complete.");
  console.log("Manager login: manager@clinic.test / password123");
  console.log("Staff logins: <imported email> / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
