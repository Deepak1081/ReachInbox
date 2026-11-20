import { prisma } from '../config/prisma.js';
import { addEmailJob } from '../queues/emailQueue.js';
import { generateIdempotencyKey } from '../utils/crypto.js';
import { elasticsearchService } from '../integrations/elasticsearch.js';
import { RateLimiterService } from './rateLimiter.js';
import { EmailSearchParams, EmailStats } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export class EmailService {
  /**
   * Schedule a batch of emails for a campaign with BullMQ delayed jobs
   */
  static async scheduleEmails(
    userId: string,
    payload: {
      subject: string;
      body: string;
      recipientEmails: string[];
      senderId: string;
      startTime?: string | Date;
      delayBetweenEmails?: number;
      hourlyLimit?: number;
    }
  ) {
    const { subject, body, recipientEmails, senderId } = payload;
    const delayBetweenEmails = payload.delayBetweenEmails ?? env.MIN_DELAY_BETWEEN_EMAILS_MS;
    const hourlyLimit = payload.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const startTime = payload.startTime ? new Date(payload.startTime) : new Date();

    // Verify sender belongs to user
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender not found or not authorized');
    }

    // Clean and deduplicate recipient emails
    const uniqueRecipients = Array.from(
      new Set(
        recipientEmails
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      )
    );

    if (uniqueRecipients.length === 0) {
      throw new Error('No valid recipient emails provided');
    }

    // 1. Create EmailCampaign record in DB
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        subject,
        body,
        startTime,
        delayBetweenEmails,
        hourlyLimit,
        status: 'scheduled',
      },
    });

    const scheduledEmailsList: any[] = [];
    let currentScheduleTime = new Date(Math.max(startTime.getTime(), Date.now()));

    // 2. Prepare individual scheduled email records with staggered delivery times
    for (let i = 0; i < uniqueRecipients.length; i++) {
      const recipient = uniqueRecipients[i];
      // Calculate schedule time: start + (i * delayBetweenEmails)
      const scheduledAt = new Date(currentScheduleTime.getTime() + i * delayBetweenEmails);
      const idempotencyKey = generateIdempotencyKey(userId, senderId, recipient, campaign.id, scheduledAt);

      // Check if duplicate idempotency key exists
      const existing = await prisma.scheduledEmail.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        logger.warn(`Skipping duplicate email with idempotency key: ${idempotencyKey}`);
        continue;
      }

      // Create record in PostgreSQL
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          campaignId: campaign.id,
          userId,
          senderId,
          recipientEmail: recipient,
          subject,
          body,
          scheduledAt,
          status: 'scheduled',
          idempotencyKey,
        },
      });

      // 3. Add delayed job to BullMQ
      const bullJobId = await addEmailJob(
        {
          emailId: emailRecord.id,
          campaignId: campaign.id,
          userId,
          senderId,
          recipientEmail: recipient,
          subject,
          body,
          scheduledAt: scheduledAt.toISOString(),
          idempotencyKey,
          hourlyLimit,
          delayBetweenEmails,
        },
        scheduledAt
      );

      // 4. Update PostgreSQL with the BullMQ job ID
      const updatedRecord = await prisma.scheduledEmail.update({
        where: { id: emailRecord.id },
        data: { bullJobId },
      });

      // 5. Index into Elasticsearch
      elasticsearchService.indexEmail({
        id: updatedRecord.id,
        campaignId: campaign.id,
        userId,
        senderId,
        senderEmail: sender.email,
        recipientEmail: recipient,
        subject,
        body,
        status: 'scheduled',
        scheduledAt,
        createdAt: updatedRecord.createdAt,
      });

      scheduledEmailsList.push(updatedRecord);
    }

    return {
      campaign,
      totalScheduled: scheduledEmailsList.length,
      emails: scheduledEmailsList,
    };
  }

  /**
   * Get scheduled emails with pagination and status filtering
   */
  static async getScheduledEmails(
    userId: string,
    options: { page?: number; limit?: number; status?: string }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      status: options.status ? options.status : { in: ['scheduled', 'processing'] },
    };

    const [items, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        include: {
          sender: { select: { id: true, email: true, displayName: true } },
          campaign: { select: { id: true, subject: true, startTime: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get sent emails (sent or failed) with pagination
   */
  static async getSentEmails(
    userId: string,
    options: { page?: number; limit?: number; status?: string }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      status: options.status ? options.status : { in: ['sent', 'failed'] },
    };

    const [items, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        include: {
          sender: { select: { id: true, email: true, displayName: true } },
          campaign: { select: { id: true, subject: true } },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single email by ID
   */
  static async getEmailById(userId: string, emailId: string) {
    const email = await prisma.scheduledEmail.findFirst({
      where: { id: emailId, userId },
      include: {
        sender: true,
        campaign: true,
      },
    });

    if (!email) {
      throw new Error('Email not found');
    }

    return email;
  }

  /**
   * Get dashboard statistics
   */
  static async getEmailStats(userId: string): Promise<EmailStats> {
    const [total, scheduled, processing, sent, failed, defaultSender] = await Promise.all([
      prisma.scheduledEmail.count({ where: { userId } }),
      prisma.scheduledEmail.count({ where: { userId, status: 'scheduled' } }),
      prisma.scheduledEmail.count({ where: { userId, status: 'processing' } }),
      prisma.scheduledEmail.count({ where: { userId, status: 'sent' } }),
      prisma.scheduledEmail.count({ where: { userId, status: 'failed' } }),
      prisma.sender.findFirst({ where: { userId, isDefault: true } }) ||
        prisma.sender.findFirst({ where: { userId } }),
    ]);

    let hourlyQuotaRemaining = env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    if (defaultSender) {
      const usage = await RateLimiterService.getSenderHourlyUsage(defaultSender.id);
      hourlyQuotaRemaining = usage.remaining;
    }

    return {
      total,
      scheduled,
      processing,
      sent,
      failed,
      hourlyQuotaRemaining,
    };
  }

  /**
   * Search emails using Elasticsearch with database fallback
   */
  static async searchEmails(userId: string, params: EmailSearchParams) {
    // 1. Attempt search through Elasticsearch
    const esResult = await elasticsearchService.searchEmails(userId, params);

    if (esResult) {
      const page = params.page || 1;
      const limit = params.limit || 20;
      return {
        items: esResult.hits,
        total: esResult.total,
        page,
        limit,
        totalPages: Math.ceil(esResult.total / limit),
        source: 'elasticsearch',
      };
    }

    // 2. Database fallback if Elasticsearch is unavailable
    logger.debug('Using PostgreSQL fallback for email search');
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (params.status) where.status = params.status;
    if (params.campaignId) where.campaignId = params.campaignId;
    if (params.recipientEmail) {
      where.recipientEmail = { contains: params.recipientEmail, mode: 'insensitive' };
    }
    if (params.q) {
      where.OR = [
        { subject: { contains: params.q, mode: 'insensitive' } },
        { body: { contains: params.q, mode: 'insensitive' } },
        { recipientEmail: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        include: {
          sender: { select: { id: true, email: true, displayName: true } },
          campaign: { select: { id: true, subject: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'database',
    };
  }
}
