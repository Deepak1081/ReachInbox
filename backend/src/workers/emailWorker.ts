import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, rescheduleEmailJob } from '../queues/emailQueue.js';
import { getBullRedisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { RateLimiterService } from '../services/rateLimiter.js';
import { etherealService } from '../integrations/ethereal.js';
import { slackService } from '../integrations/slack.js';
import { elasticsearchService } from '../integrations/elasticsearch.js';
import { EmailJobData, EmailJobResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

let emailWorker: Worker<EmailJobData, EmailJobResult> | null = null;

export function initEmailWorker(): Worker<EmailJobData, EmailJobResult> {
  if (emailWorker) {
    return emailWorker;
  }

  const connection = getBullRedisConnection();

  emailWorker = new Worker<EmailJobData, EmailJobResult>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData, EmailJobResult>): Promise<EmailJobResult> => {
      const data = job.data;
      logger.info(`[Worker] Processing email job ${job.id} for recipient: ${data.recipientEmail}`);

      // 1. Fetch current email record from PostgreSQL
      const emailRecord = await prisma.scheduledEmail.findUnique({
        where: { id: data.emailId },
        include: { sender: true, campaign: true },
      });

      if (!emailRecord) {
        logger.warn(`[Worker] Email record ${data.emailId} not found in database; aborting job`);
        return { success: false, errorMessage: 'Email record not found' };
      }

      // Idempotency check: if already sent, do not re-send
      if (emailRecord.status === 'sent') {
        logger.info(`[Worker] Email ${data.emailId} already marked as sent. Skipping to prevent duplicate send.`);
        return { success: true, messageId: emailRecord.messageId || undefined };
      }

      // 2. Transition DB state to 'processing'
      await prisma.scheduledEmail.update({
        where: { id: data.emailId },
        data: { status: 'processing', updatedAt: new Date() },
      });

      // Update campaign status to 'in_progress'
      if (emailRecord.campaign.status === 'scheduled') {
        await prisma.emailCampaign.update({
          where: { id: emailRecord.campaignId },
          data: { status: 'in_progress' },
        });
      }

      // 3. Hourly rate-limiting check using atomic Redis Lua script
      const hourlyLimit = data.hourlyLimit || emailRecord.campaign.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
      const rateLimitCheck = await RateLimiterService.checkAndConsumeHourlyLimit(data.senderId, hourlyLimit);

      if (!rateLimitCheck.allowed) {
        // Hourly limit reached!
        const nextWindowStart = rateLimitCheck.resetTime;
        logger.warn(
          `[Worker] Hourly limit (${hourlyLimit}) reached for sender ${emailRecord.sender.email}. Rescheduling email ${data.emailId} to ${nextWindowStart.toISOString()}`
        );

        // Count pending emails for this sender to report in Slack
        const pendingCount = await prisma.scheduledEmail.count({
          where: {
            senderId: data.senderId,
            status: { in: ['scheduled', 'processing'] },
          },
        });

        // Reschedule in BullMQ with delay to the next hour window
        await rescheduleEmailJob(
          {
            ...data,
            scheduledAt: nextWindowStart.toISOString(),
          },
          nextWindowStart
        );

        // Update DB record with new scheduledAt and status back to 'scheduled'
        await prisma.scheduledEmail.update({
          where: { id: data.emailId },
          data: {
            scheduledAt: nextWindowStart,
            status: 'scheduled',
            updatedAt: new Date(),
          },
        });

        // Trigger Slack notification (deduplicated per sender per hour window in Redis)
        slackService
          .sendHourlyLimitAlert({
            userId: data.userId,
            senderId: data.senderId,
            senderEmail: emailRecord.sender.email,
            hourlyLimit,
            hourWindow: RateLimiterService.getHourWindow(new Date()),
            delayedEmailsCount: pendingCount,
            nextScheduledTime: nextWindowStart,
          })
          .catch((slackErr) => {
            logger.warn('Failed to dispatch Slack alert:', slackErr.message);
          });

        return {
          success: false,
          rescheduled: true,
          rescheduledFor: nextWindowStart.toISOString(),
        };
      }

      // 4. Rate limit check passed: Coordinate inter-email delay across concurrent workers
      const minDelay = data.delayBetweenEmails || emailRecord.campaign.delayBetweenEmails || env.MIN_DELAY_BETWEEN_EMAILS_MS;
      await RateLimiterService.coordinateInterEmailDelay(data.senderId, minDelay);

      // 5. Send actual email via Ethereal SMTP
      try {
        const sendResult = await etherealService.sendEmail(
          emailRecord.sender,
          data.recipientEmail,
          data.subject,
          data.body
        );

        const sentAt = new Date();
        const etherealUrl = sendResult.previewUrl ? sendResult.previewUrl.toString() : null;

        // 6. Transactionally update PostgreSQL status to 'sent'
        await prisma.scheduledEmail.update({
          where: { id: data.emailId },
          data: {
            status: 'sent',
            sentAt,
            messageId: sendResult.messageId,
            etherealUrl,
            errorMessage: null,
            updatedAt: sentAt,
          },
        });

        // 7. Sync document to Elasticsearch asynchronously
        elasticsearchService.indexEmail({
          id: data.emailId,
          campaignId: data.campaignId,
          userId: data.userId,
          senderId: data.senderId,
          senderEmail: emailRecord.sender.email,
          recipientEmail: data.recipientEmail,
          subject: data.subject,
          body: data.body,
          status: 'sent',
          scheduledAt: emailRecord.scheduledAt,
          sentAt,
          createdAt: emailRecord.createdAt,
          etherealUrl,
        });

        // Check if all emails in the campaign are completed
        const remainingInCampaign = await prisma.scheduledEmail.count({
          where: {
            campaignId: data.campaignId,
            status: { in: ['scheduled', 'processing'] },
          },
        });

        if (remainingInCampaign === 0) {
          await prisma.emailCampaign.update({
            where: { id: data.campaignId },
            data: { status: 'completed' },
          });
          logger.info(`[Worker] Campaign ${data.campaignId} marked as completed!`);
        }

        logger.info(`[Worker] Email ${data.emailId} successfully sent to ${data.recipientEmail}`);
        return {
          success: true,
          messageId: sendResult.messageId,
          etherealUrl: etherealUrl || undefined,
        };
      } catch (sendError: any) {
        logger.error(`[Worker] SMTP delivery failed for email ${data.emailId}:`, sendError.message);

        // Update database with failed status and error details
        await prisma.scheduledEmail.update({
          where: { id: data.emailId },
          data: {
            status: 'failed',
            errorMessage: sendError.message,
            updatedAt: new Date(),
          },
        });

        // Sync failure status to Elasticsearch
        elasticsearchService.indexEmail({
          id: data.emailId,
          campaignId: data.campaignId,
          userId: data.userId,
          senderId: data.senderId,
          senderEmail: emailRecord.sender.email,
          recipientEmail: data.recipientEmail,
          subject: data.subject,
          body: data.body,
          status: 'failed',
          scheduledAt: emailRecord.scheduledAt,
          createdAt: emailRecord.createdAt,
          errorMessage: sendError.message,
        });

        return {
          success: false,
          errorMessage: sendError.message,
        };
      }
    },
    {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  emailWorker.on('completed', (job) => {
    logger.debug(`[Worker] Job ${job.id} completed successfully`);
  });

  emailWorker.on('failed', (job, err) => {
    logger.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
  });

  logger.info(`BullMQ Worker started with concurrency: ${env.WORKER_CONCURRENCY}`);
  return emailWorker;
}

export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    logger.info('BullMQ Worker closed gracefully');
  }
}
