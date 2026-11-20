import { Queue } from 'bullmq';
import { getBullRedisConnection } from '../config/redis.js';
import { EmailJobData } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const EMAIL_QUEUE_NAME = 'email-delivery';

let emailQueue: Queue<EmailJobData>;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    const connection = getBullRedisConnection();
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400 * 7, // keep 7 days
          count: 5000,
        },
        removeOnFail: {
          age: 86400 * 14, // keep 14 days
          count: 5000,
        },
      },
    });

    emailQueue.on('error', (err) => {
      logger.error('BullMQ Queue error:', err.message);
    });

    logger.info(`BullMQ Queue '${EMAIL_QUEUE_NAME}' initialized`);
  }
  return emailQueue;
}

/**
 * Enqueue a delayed email job into BullMQ
 */
export async function addEmailJob(
  data: EmailJobData,
  scheduledAt: Date
): Promise<string> {
  const queue = getEmailQueue();
  const now = Date.now();
  const scheduledTime = scheduledAt.getTime();
  const delay = Math.max(0, scheduledTime - now);

  // Stable BullMQ job ID based on email record ID to ensure uniqueness and restart stability
  const jobId = `email-job-${data.emailId}`;

  const job = await queue.add('send-email', data, {
    jobId,
    delay,
  });

  logger.info(
    `Enqueued BullMQ job ${job.id} for ${data.recipientEmail} with delay ${delay}ms (scheduled at: ${scheduledAt.toISOString()})`
  );

  return job.id!;
}

/**
 * Reschedule an existing email job with a new delay
 */
export async function rescheduleEmailJob(
  data: EmailJobData,
  newScheduledAt: Date
): Promise<string> {
  const queue = getEmailQueue();
  const now = Date.now();
  const delay = Math.max(0, newScheduledAt.getTime() - now);
  const jobId = `email-job-${data.emailId}`;

  // Check if job exists in BullMQ, remove old if present to reschedule cleanly
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    try {
      await existingJob.remove();
    } catch (err: any) {
      logger.warn(`Could not remove old job ${jobId} during reschedule:`, err.message);
    }
  }

  const job = await queue.add('send-email', data, {
    jobId,
    delay,
  });

  logger.info(`Rescheduled BullMQ job ${job.id} to new delay: ${delay}ms (${newScheduledAt.toISOString()})`);
  return job.id!;
}
