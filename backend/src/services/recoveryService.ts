import { getEmailQueue } from '../queues/emailQueue.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { EmailJobData } from '../types/index.js';

export interface RecoveryStats {
  totalChecked: number;
  alreadyInQueue: number;
  reEnqueued: number;
  processingReset: number;
}

export class RecoveryService {
  /**
   * Reconciles PostgreSQL email records with BullMQ Redis queue on startup.
   * Restores missing jobs with their original schedule without duplicating existing jobs.
   */
  static async reconcileAndRecoverJobs(): Promise<RecoveryStats> {
    logger.info('Starting Queue Reconciliation and Restart Recovery...');
    const queue = getEmailQueue();

    const stats: RecoveryStats = {
      totalChecked: 0,
      alreadyInQueue: 0,
      reEnqueued: 0,
      processingReset: 0,
    };

    try {
      // Find all emails in 'scheduled' or 'processing' status
      const pendingEmails = await prisma.scheduledEmail.findMany({
        where: {
          status: { in: ['scheduled', 'processing'] },
        },
        include: {
          campaign: true,
        },
        orderBy: {
          scheduledAt: 'asc',
        },
      });

      stats.totalChecked = pendingEmails.length;
      logger.info(`Found ${pendingEmails.length} pending emails in database to reconcile`);

      for (const email of pendingEmails) {
        const jobId = `email-job-${email.id}`;

        // Check if job exists in BullMQ
        const existingJob = await queue.getJob(jobId);

        if (existingJob) {
          const state = await existingJob.getState();
          logger.debug(`Job ${jobId} already exists in BullMQ (state: ${state})`);
          stats.alreadyInQueue++;

          // If DB was stuck in 'processing' from an ungraceful server termination,
          // reset to 'scheduled' if job is waiting or delayed
          if (email.status === 'processing' && (state === 'delayed' || state === 'waiting')) {
            await prisma.scheduledEmail.update({
              where: { id: email.id },
              data: { status: 'scheduled' },
            });
            stats.processingReset++;
          }
        } else {
          // Job missing from BullMQ (e.g. Redis crash/flush or un-synced write)
          const now = Date.now();
          const targetTime = email.scheduledAt.getTime();
          const delay = Math.max(0, targetTime - now);

          const jobData: EmailJobData = {
            emailId: email.id,
            campaignId: email.campaignId,
            userId: email.userId,
            senderId: email.senderId,
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            scheduledAt: email.scheduledAt.toISOString(),
            idempotencyKey: email.idempotencyKey,
            hourlyLimit: email.campaign.hourlyLimit,
            delayBetweenEmails: email.campaign.delayBetweenEmails,
          };

          await queue.add('send-email', jobData, {
            jobId,
            delay,
          });

          // Reset status to scheduled if it was processing
          if (email.status === 'processing') {
            await prisma.scheduledEmail.update({
              where: { id: email.id },
              data: { status: 'scheduled' },
            });
            stats.processingReset++;
          }

          logger.info(
            `[Recovery] Restored missing job ${jobId} to BullMQ for ${email.recipientEmail} with delay ${delay}ms`
          );
          stats.reEnqueued++;
        }
      }

      logger.info('Queue Reconciliation completed successfully:', stats);
      return stats;
    } catch (error: any) {
      logger.error('Error during queue recovery and reconciliation:', error.message);
      return stats;
    }
  }
}
