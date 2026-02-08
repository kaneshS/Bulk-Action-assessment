import type { Request, Response, NextFunction } from "express";
import { createRedisClient } from "../config/redis.js";
import { config } from "../config/index.js";
import { parseEntityIdsFromCsv } from "../utils/csv-parser.js";

const redis = createRedisClient();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_EVENTS = config.rateLimitPerMinute;

/**
 * Get entity count from request for rate limiting.
 * Supports entityIds array, entityIdsCsv string, or CSV file upload.
 */
function getEntityCount(req: Request): number {
  try {
    const body = req.body;
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      if (Array.isArray(b.entityIds)) return b.entityIds.length;
      if (typeof b.entityIdsCsv === "string") return parseEntityIdsFromCsv(b.entityIdsCsv).length;
    }
    const reqWithFile = req as Request & { file?: { buffer?: Buffer } };
    const file = reqWithFile.file;
    if (file && file.buffer) {
      const csv = file.buffer.toString("utf-8");
      return parseEntityIdsFromCsv(csv).length;
    }
  } catch {
    // Fallback if parsing fails
  }
  return 1;
}

/**
 * Rate limit by accountId. Counts each entity as 1 event.
 * 10k entities per minute per account.
 */
export async function rateLimitByAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const accountId = req.body?.accountId ?? req.query.accountId;
  if (!accountId) {
    next();
    return;
  }

  const entityCount = getEntityCount(req);
  const key = `ratelimit:${accountId}:${Math.floor(Date.now() / WINDOW_MS)}`;

  try {
    const current = parseInt((await redis.get(key)) ?? "0", 10);
    const newTotal = current + entityCount;

    if (newTotal > MAX_EVENTS) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Maximum ${MAX_EVENTS} entities per minute per account. Requested ${entityCount} would exceed limit.`,
      });
      return;
    }

    await redis.incrby(key, entityCount);
    await redis.expire(key, 120); // 2 min TTL

    next();
  } catch (err) {
    console.error("Rate limit check failed:", err);
    next(); // Fail open
  }
}
