import { Queue } from "bullmq";
import { createRedisClient } from "../config/redis.js";

const connection = createRedisClient();

export const bulkActionQueue = new Queue("bulk-actions", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
  },
});
