export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  batchSize: parseInt(process.env.BATCH_SIZE ?? "100", 10),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "10000", 10),
} as const;
