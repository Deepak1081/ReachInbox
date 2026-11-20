import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { RateLimitCheckResult } from '../types/index.js';

export class RateLimiterService {
  /**
   * Generates hour window string: "YYYY-MM-DD-HH" (e.g. "2026-11-20-16")
   */
  static getHourWindow(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    return `${y}-${m}-${d}-${h}`;
  }

  /**
   * Calculates the exact Date when the next hour window starts (UTC)
   */
  static getNextHourWindowStart(date: Date = new Date()): Date {
    const next = new Date(date);
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
    return next;
  }

  /**
   * Atomically checks and reserves 1 email sending quota for a sender using a Redis Lua script.
   * If limit is reached, returns allowed: false with the next reset time and retry delay.
   */
  static async checkAndConsumeHourlyLimit(
    senderId: string,
    customLimit?: number
  ): Promise<RateLimitCheckResult> {
    const limit = customLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `ratelimit:sender:${senderId}:${hourWindow}`;
    const nextWindowStart = this.getNextHourWindowStart(now);
    const ttlSeconds = 7200; // 2 hours

    // Atomic Lua script: check limit, increment if allowed
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return {0, tonumber(current)}
      else
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
        end
        return {1, count}
      end
    `;

    try {
      const result = (await redis.eval(luaScript, 1, key, limit, ttlSeconds)) as [number, number];
      const allowed = result[0] === 1;
      const currentCount = result[1];
      const remaining = Math.max(0, limit - currentCount);

      if (!allowed) {
        const retryAfterMs = Math.max(1000, nextWindowStart.getTime() - now.getTime());
        logger.warn(
          `Sender ${senderId} exceeded hourly limit (${limit}). Current count: ${currentCount}. Rescheduling to: ${nextWindowStart.toISOString()}`
        );

        return {
          allowed: false,
          currentCount,
          limit,
          remaining: 0,
          resetTime: nextWindowStart,
          retryAfterMs,
        };
      }

      // Periodically update PostgreSQL RateLimitRecord asynchronously for persistent auditing
      prisma.rateLimitRecord
        .upsert({
          where: {
            senderId_hourWindow: {
              senderId,
              hourWindow,
            },
          },
          create: {
            senderId,
            hourWindow,
            count: currentCount,
          },
          update: {
            count: currentCount,
            updatedAt: new Date(),
          },
        })
        .catch((dbErr) => {
          logger.warn('Failed to asynchronously sync rate limit record to DB:', dbErr.message);
        });

      return {
        allowed: true,
        currentCount,
        limit,
        remaining,
        resetTime: nextWindowStart,
      };
    } catch (err: any) {
      logger.error('Error executing rate limiter Lua script:', err.message);
      // Fallback: allow to avoid complete queue blockage on redis error
      return {
        allowed: true,
        currentCount: 0,
        limit,
        remaining: limit,
        resetTime: nextWindowStart,
      };
    }
  }

  /**
   * Enforce inter-email minimum delay across all concurrent workers using Redis distributed timestamp
   */
  static async coordinateInterEmailDelay(
    senderId: string,
    minDelayMs: number = env.MIN_DELAY_BETWEEN_EMAILS_MS
  ): Promise<void> {
    if (minDelayMs <= 0) return;

    const key = `throttle:sender:${senderId}:next_available`;
    const nowMs = Date.now();

    // Lua script to atomically reserve next execution timestamp
    const luaThrottleScript = `
      local now = tonumber(ARGV[1])
      local min_delay = tonumber(ARGV[2])
      local next_avail = redis.call('GET', KEYS[1])
      local scheduled_time = now
      if next_avail and tonumber(next_avail) > now then
        scheduled_time = tonumber(next_avail)
      end
      local new_next = scheduled_time + min_delay
      redis.call('SET', KEYS[1], new_next, 'PX', min_delay * 10)
      return scheduled_time
    `;

    try {
      const scheduledTimeMs = (await redis.eval(luaThrottleScript, 1, key, nowMs, minDelayMs)) as number;
      const waitTimeMs = scheduledTimeMs - nowMs;

      if (waitTimeMs > 0) {
        logger.debug(`Worker throttling: waiting ${waitTimeMs}ms for sender ${senderId} to satisfy min inter-email delay`);
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      }
    } catch (err: any) {
      logger.warn('Failed to coordinate inter-email delay via Redis, continuing:', err.message);
    }
  }

  /**
   * Get current hourly usage and remaining quota for a sender
   */
  static async getSenderHourlyUsage(senderId: string, limit?: number): Promise<{
    currentCount: number;
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    const maxLimit = limit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `ratelimit:sender:${senderId}:${hourWindow}`;

    const countStr = await redis.get(key);
    const currentCount = countStr ? parseInt(countStr, 10) : 0;
    const remaining = Math.max(0, maxLimit - currentCount);
    const resetTime = this.getNextHourWindowStart(now);

    return {
      currentCount,
      limit: maxLimit,
      remaining,
      resetTime,
    };
  }
}
