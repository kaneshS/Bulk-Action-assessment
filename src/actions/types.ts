import type { BulkActionLogStatus } from "@prisma/client";

export interface IBulkActionHandler<TEntity = unknown, TPayload = unknown> {
  readonly entityType: string;
  readonly actionType: string;

  validate(payload: TPayload): void;

  execute(
    entityIds: string[],
    payload: TPayload,
    context: BulkActionContext
  ): Promise<BulkActionResult[]>;
}

export interface BulkActionContext {
  bulkActionId: string;
  accountId: string;
  prisma: import("@prisma/client").PrismaClient;
}

export interface BulkActionResult {
  entityId: string;
  status: BulkActionLogStatus;
  errorMessage?: string;
  skipReason?: string;
}
