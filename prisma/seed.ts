import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const csvPath = path.join(process.cwd(), "seeds", "contacts.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  const dataLines = lines.slice(1);

  const batchSize = 100;
  let created = 0;

  for (let i = 0; i < dataLines.length; i += batchSize) {
    const batch = dataLines.slice(i, i + batchSize);
    const contacts = batch.map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number> = {};
      headers.forEach((h, idx) => {
        const v = values[idx];
        row[h] = h === "age" ? (v ? parseInt(v, 10) : 0) : v ?? "";
      });
      return {
        name: String(row.name),
        email: String(row.email),
        age: Number(row.age) || null,
        status: String(row.status || "active"),
        accountId: String(row.accountId),
      };
    });

    await prisma.contact.createMany({
      data: contacts,
      skipDuplicates: true,
    });
    created += contacts.length;
    console.log(`Seeded ${created}/${dataLines.length} contacts`);
  }

  console.log(`Seed complete: ${created} contacts created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
