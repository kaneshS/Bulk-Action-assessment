import { Worker, Job } from "bullmq";
import { createRedisClient } from "./config/redis.js";
import { config } from "./config/index.js";
import { prisma } from "./db/client.js";
import { getHandler } from "./actions/index.js";
import { BulkActionStatus, BulkActionLogStatus } from "@prisma/client";

// Ensure handlers are registered
import "./actions/index.js";

const connection = createRedisClient();
const batchSize = config.batchSize;

interface BulkActionJobData {
  bulkActionId: string;
  accountId: string;
  entityType: string;
  actionType: string;
  entityIds: string[];
  payload: unknown;
}

async function deduplicateByEmail(
  entityIds: string[],
  accountId: string
): Promise<{ toProcess: string[]; skipped: Array<{ entityId: string; email: string }> }> {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: entityIds }, accountId },
    select: { id: true, email: true },
  });

  const idToEmail = new Map(contacts.map((c) => [c.id, c.email]));
  const seenEmails = new Set<string>();
  const toProcess: string[] = [];
  const skipped: Array<{ entityId: string; email: string }> = [];

  for (const id of entityIds) {
    const email = idToEmail.get(id);
    if (!email) {
      toProcess.push(id); // Not found in DB - handler will mark as failure
      continue;
    }
    if (seenEmails.has(email)) {
      skipped.push({ entityId: id, email });
    } else {
      seenEmails.add(email);
      toProcess.push(id);
    }
  }

  return { toProcess, skipped };
}

async function processJob(job: Job<BulkActionJobData>) {
  const { bulkActionId, accountId, entityType, actionType, entityIds, payload } = job.data;

  const handler = getHandler(entityType, actionType);
  if (!handler) {
    throw new Error(`No handler for ${entityType}:${actionType}`);
  }

  await prisma.bulkAction.update({
    where: { id: bulkActionId },
    data: { status: BulkActionStatus.processing },
  });

  // De-duplicate by email
  const { toProcess, skipped } = await deduplicateByEmail(entityIds, accountId);

  // Log skipped (duplicates)
  if (skipped.length > 0) {
    await prisma.bulkActionLog.createMany({
      data: skipped.map((s) => ({
        bulkActionId,
        entityId: s.entityId,
        status: BulkActionLogStatus.skipped,
        skipReason: "duplicate_email",
      })),
    });
  }

  const context = { bulkActionId, accountId, prisma };
  const allResults: Array<{
    entityId: string;
    status: (typeof BulkActionLogStatus)[keyof typeof BulkActionLogStatus];
    errorMessage?: string;
    skipReason?: string;
  }> = [];

  // Process in batches
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    const results = await handler.execute(batch, payload, context);
    allResults.push(...results);

    await prisma.bulkActionLog.createMany({
      data: results.map((r) => ({
        bulkActionId,
        entityId: r.entityId,
        status: r.status,
        errorMessage: r.errorMessage ?? null,
        skipReason: r.skipReason ?? null,
      })),
    });
  }

  const successCount = allResults.filter((r) => r.status === "success").length;
  const failureCount = allResults.filter((r) => r.status === "failure").length;
  const skippedCount = skipped.length;

  await prisma.bulkAction.update({
    where: { id: bulkActionId },
    data: {
      status: BulkActionStatus.completed,
      completedAt: new Date(),
    },
  });

  return { successCount, failureCount, skippedCount };
}

const worker = new Worker<BulkActionJobData>(
  "bulk-actions",
  async (job) => {
    try {
      return await processJob(job);
    } catch (err) {
      await prisma.bulkAction.update({
        where: { id: job.data.bulkActionId },
        data: {
          status: BulkActionStatus.failed,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log("Bulk action worker started");
