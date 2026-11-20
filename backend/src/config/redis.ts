import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// Singleton Redis client for application rate-limiting, caching, and locks
export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info(`Redis connected successfully at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

export function getBullRedisConnection(): Redis {
  return new Redis(redisConfig);
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
