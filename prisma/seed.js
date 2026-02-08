"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
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
            const row = {};
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
//# sourceMappingURL=seed.js.map