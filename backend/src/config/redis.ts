import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const baseOptions = {
  maxRetriesPerRequest: null as null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// If REDIS_URL is provided (Railway / production), use it; otherwise fall back to host/port
function createRedisClient(): Redis {
  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, baseOptions);
  }
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    ...baseOptions,
  });
}

// Legacy config object kept for getBullRedisConnection compatibility
export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  ...baseOptions,
};

// Singleton Redis client for application rate-limiting, caching, and locks
export const redis = createRedisClient();

redis.on('connect', () => {
  logger.info(`Redis connected successfully${env.REDIS_URL ? ' via REDIS_URL' : ` at ${env.REDIS_HOST}:${env.REDIS_PORT}`}`);
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

export function getBullRedisConnection(): Redis {
  return createRedisClient();
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err: any) {
    logger.error('Redis health check failed:', err.message);
    return false;
  }
}
