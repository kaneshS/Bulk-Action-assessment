/**
 * Generates seeds/contacts.csv with 2500 sample contacts.
 * Run: npx tsx scripts/generate-contacts.ts
 */
import * as fs from "fs";
import * as path from "path";

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
];

const ACCOUNTS = ["acc_001", "acc_002", "acc_003"];
const STATUSES = ["active", "inactive", "pending"];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(first: string, last: string, i: number): string {
  const base = `${first.toLowerCase()}.${last.toLowerCase()}`.replace(/\s/g, "");
  return `${base}${i}@example.com`;
}

function main() {
  const contacts: string[][] = [["name", "email", "age", "status", "accountId"]];
  const usedEmails = new Set<string>();

  for (let i = 0; i < 2500; i++) {
    const first = randomChoice(FIRST_NAMES);
    const last = randomChoice(LAST_NAMES);
    let email = generateEmail(first, last, i);
    while (usedEmails.has(email)) {
      email = generateEmail(first, last, i + 10000);
    }
    usedEmails.add(email);

    const age = 18 + Math.floor(Math.random() * 50);
    const status = randomChoice(STATUSES);
    const accountId = randomChoice(ACCOUNTS);

    contacts.push([`${first} ${last}`, email, String(age), status, accountId]);
  }

  const csv = contacts.map((row) => row.join(",")).join("\n");
  const outPath = path.join(process.cwd(), "seeds", "contacts.csv");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, csv, "utf-8");
  console.log(`Generated ${contacts.length - 1} contacts at ${outPath}`);
}

main();
