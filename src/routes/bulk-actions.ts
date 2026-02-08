import { Router, Request, Response } from "express";
import multer from "multer";
import {
  createBulkAction,
  getBulkAction,
  listBulkActions,
  getBulkActionStats,
  getBulkActionLogs,
} from "../services/bulk-action.service.js";
import { rateLimitByAccount } from "../middleware/rate-limit.js";
import { parseEntityIdsFromCsv } from "../utils/csv-parser.js";
import { BulkActionStatus } from "@prisma/client";
import { z } from "zod";

export const bulkActionsRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

const createBulkActionSchema = z
  .object({
    accountId: z.string().min(1),
    entityType: z.string().min(1),
    actionType: z.string().min(1),
    entityIds: z.array(z.string()).optional(),
    entityIdsCsv: z.string().optional(),
    payload: z.record(z.unknown()),
    scheduledAt: z.string().datetime().optional(),
  })
  .refine(
    (data) =>
      (data.entityIds?.length ?? 0) > 0 || (data.entityIdsCsv?.trim().length ?? 0) > 0,
    {
      message: "Provide either entityIds array or entityIdsCsv string",
      path: ["entityIds"],
    }
  );

function resolveEntityIds(entityIds?: string[], entityIdsCsv?: string): string[] {
  if (entityIds && entityIds.length > 0) return entityIds;
  if (entityIdsCsv?.trim()) return parseEntityIdsFromCsv(entityIdsCsv);
  return [];
}

bulkActionsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const status = req.query.status as BulkActionStatus | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const { actions, total } = await listBulkActions({
      accountId,
      status,
      limit,
      offset,
    });

    res.json({ actions, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list bulk actions" });
  }
});

bulkActionsRouter.post("/", rateLimitByAccount, async (req: Request, res: Response) => {
  try {
    const parsed = createBulkActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const { accountId, entityType, actionType, entityIds, entityIdsCsv, payload, scheduledAt } =
      parsed.data;

    const resolvedEntityIds = resolveEntityIds(entityIds, entityIdsCsv);

    if (resolvedEntityIds.length === 0) {
      res.status(400).json({ error: "At least one entity ID required (entityIds or entityIdsCsv)" });
      return;
    }

    const actionId = await createBulkAction({
      accountId,
      entityType,
      actionType,
      entityIds: resolvedEntityIds,
      payload,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    res.status(201).json({ id: actionId, message: "Bulk action created and queued" });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Failed to create bulk action";
    res.status(400).json({ error: msg });
  }
});

/**
 * Create bulk action from CSV file upload.
 * Multipart: file (CSV), accountId, entityType, actionType, payload (JSON string), scheduledAt?
 * CSV format: one ID per line, or comma-separated. Header row optional (first column used if multiple).
 */
bulkActionsRouter.post(
  "/from-csv",
  upload.single("file"),
  rateLimitByAccount,
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "CSV file required (field: file)" });
        return;
      }

      const buffer = (file as { buffer?: Buffer }).buffer;
      if (!buffer) {
        res.status(400).json({ error: "File upload failed - ensure field name is 'file' and file is selected" });
        return;
      }

      const csvString = buffer.toString("utf-8");
      const entityIds = parseEntityIdsFromCsv(csvString);

      if (entityIds.length === 0) {
        res.status(400).json({ error: "CSV file contains no valid entity IDs" });
        return;
      }

      const bodySchema = z.object({
        accountId: z.string().min(1),
        entityType: z.string().min(1),
        actionType: z.string().min(1),
        payload: z.record(z.unknown()),
        scheduledAt: z.string().datetime().optional(),
      });

      let payloadData: Record<string, unknown> = {};
      if (typeof req.body.payload === "string") {
        try {
          payloadData = JSON.parse(req.body.payload || "{}");
        } catch {
          payloadData = {};
        }
      } else if (req.body.payload && typeof req.body.payload === "object") {
        payloadData = req.body.payload;
      }

      const parsed = bodySchema.safeParse({ ...req.body, payload: payloadData });

      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
        return;
      }

      const { accountId, entityType, actionType, payload, scheduledAt } = parsed.data;

      const actionId = await createBulkAction({
        accountId,
        entityType,
        actionType,
        entityIds,
        payload,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });

      res.status(201).json({ id: actionId, message: "Bulk action created from CSV", entityCount: entityIds.length });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to create bulk action from CSV";
      res.status(400).json({ error: msg });
    }
  }
);

bulkActionsRouter.get("/:actionId", async (req: Request, res: Response) => {
  try {
    const action = await getBulkAction(req.params.actionId);
    if (!action) {
      res.status(404).json({ error: "Bulk action not found" });
      return;
    }
    res.json(action);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get bulk action" });
  }
});

bulkActionsRouter.get("/:actionId/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getBulkActionStats(req.params.actionId);
    if (!stats) {
      res.status(404).json({ error: "Bulk action not found" });
      return;
    }
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get bulk action stats" });
  }
});

bulkActionsRouter.get("/:actionId/logs", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await getBulkActionLogs(req.params.actionId, { status, limit, offset });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get bulk action logs" });
  }
});
