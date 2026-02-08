import Redis from "ioredis";
import { config } from "./index.js";

let redisInstance: Redis | null = null;

export function createRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return redisInstance;
}
