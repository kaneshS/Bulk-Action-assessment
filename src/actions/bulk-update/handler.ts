import type { IBulkActionHandler, BulkActionContext, BulkActionResult } from "../types.js";
import { BulkActionLogStatus } from "@prisma/client";
import { validateBulkUpdatePayload, type BulkUpdatePayload } from "./validator.js";
import { registerHandler } from "../registry.js";

export class BulkUpdateHandler implements IBulkActionHandler<string, BulkUpdatePayload> {
  readonly entityType = "Contact";
  readonly actionType = "bulk-update";

  validate(payload: unknown): void {
    validateBulkUpdatePayload(payload);
  }

  async execute(
    entityIds: string[],
    payload: BulkUpdatePayload,
    context: BulkActionContext
  ): Promise<BulkActionResult[]> {
    const { prisma, accountId } = context;
    const results: BulkActionResult[] = [];

    const updateData: Record<string, unknown> = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.email !== undefined) updateData.email = payload.email;
    if (payload.age !== undefined) updateData.age = payload.age;
    if (payload.status !== undefined) updateData.status = payload.status;

    const data = updateData as { name?: string; email?: string; age?: number | null; status?: string };

    for (const entityId of entityIds) {
      try {
        const updated = await prisma.contact.updateMany({
          where: { id: entityId, accountId },
          data,
        });
        if (updated.count === 0) {
          results.push({
            entityId,
            status: BulkActionLogStatus.failure,
            errorMessage: "Contact not found",
          });
        } else {
          results.push({ entityId, status: BulkActionLogStatus.success });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          entityId,
          status: BulkActionLogStatus.failure,
          errorMessage: msg,
        });
      }
    }

    return results;
  }
}

// Register on module load
registerHandler(new BulkUpdateHandler());
