import { prisma } from "../db/client.js";
import { bulkActionQueue } from "../jobs/queues.js";
import { getHandler } from "../actions/index.js";
import { BulkActionStatus } from "@prisma/client";
import { config } from "../config/index.js";

export interface CreateBulkActionInput {
  accountId: string;
  entityType: string;
  actionType: string;
  entityIds: string[];
  payload: unknown;
  scheduledAt?: Date;
}

export async function createBulkAction(input: CreateBulkActionInput): Promise<string> {
  const handler = getHandler(input.entityType, input.actionType);
  if (!handler) {
    throw new Error(`No handler for ${input.entityType}:${input.actionType}`);
  }

  handler.validate(input.payload);

  const bulkAction = await prisma.bulkAction.create({
    data: {
      accountId: input.accountId,
      entityType: input.entityType,
      actionType: input.actionType,
      status: BulkActionStatus.queued,
      totalCount: input.entityIds.length,
      scheduledAt: input.scheduledAt ?? null,
    },
  });

  const delay = input.scheduledAt
    ? Math.max(0, input.scheduledAt.getTime() - Date.now())
    : undefined;

  await bulkActionQueue.add(
    "process",
    {
      bulkActionId: bulkAction.id,
      accountId: input.accountId,
      entityType: input.entityType,
      actionType: input.actionType,
      entityIds: input.entityIds,
      payload: input.payload,
    },
    { delay, jobId: bulkAction.id }
  );

  return bulkAction.id;
}

export async function getBulkAction(actionId: string) {
  const action = await prisma.bulkAction.findUnique({
    where: { id: actionId },
    include: {
      _count: { select: { logs: true } },
    },
  });
  if (!action) return null;

  const processedCount = await prisma.bulkActionLog.count({
    where: { bulkActionId: actionId },
  });

  return {
    ...action,
    processedCount,
    progress: action.totalCount > 0 ? (processedCount / action.totalCount) * 100 : 0,
  };
}

export async function listBulkActions(params: {
  accountId?: string;
  status?: BulkActionStatus;
  limit?: number;
  offset?: number;
}) {
  const { accountId, status, limit = 20, offset = 0 } = params;

  const where: { accountId?: string; status?: BulkActionStatus } = {};
  if (accountId) where.accountId = accountId;
  if (status) where.status = status;

  const [actions, total] = await Promise.all([
    prisma.bulkAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.bulkAction.count({ where }),
  ]);

  return { actions, total };
}

export async function getBulkActionStats(actionId: string) {
  const [action, stats] = await Promise.all([
    prisma.bulkAction.findUnique({ where: { id: actionId } }),
    prisma.bulkActionLog.groupBy({
      by: ["status"],
      where: { bulkActionId: actionId },
      _count: true,
    }),
  ]);

  if (!action) return null;

  const success = stats.find((s) => s.status === "success")?._count ?? 0;
  const failure = stats.find((s) => s.status === "failure")?._count ?? 0;
  const skipped = stats.find((s) => s.status === "skipped")?._count ?? 0;

  return {
    bulkActionId: actionId,
    totalCount: action.totalCount,
    success,
    failure,
    skipped,
    status: action.status,
  };
}

export async function getBulkActionLogs(
  actionId: string,
  params: { status?: string; limit?: number; offset?: number }
) {
  const { status, limit = 50, offset = 0 } = params;

  const where: { bulkActionId: string; status?: "success" | "failure" | "skipped" } = {
    bulkActionId: actionId,
  };
  if (status && ["success", "failure", "skipped"].includes(status)) {
    where.status = status as "success" | "failure" | "skipped";
  }

  const [logs, total] = await Promise.all([
    prisma.bulkActionLog.findMany({
      where,
      orderBy: { processedAt: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.bulkActionLog.count({ where }),
  ]);

  return { logs, total };
}
