import { z } from 'zod';

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  body: z.string().min(1, 'Email body is required'),
  recipientEmails: z.array(z.string().regex(emailRegex, 'Invalid email address')).min(1, 'At least one recipient email is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  startTime: z.string().datetime().optional().or(z.date().optional()),
  delayBetweenEmails: z.number().int().min(0).default(2000), // ms
  hourlyLimit: z.number().int().min(1).max(1000).default(200),
});

export const createSenderSchema = z.object({
  email: z.string().regex(emailRegex, 'Invalid email address'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  smtpHost: z.string().default('smtp.ethereal.email'),
  smtpPort: z.number().int().default(587),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const updateSenderSchema = createSenderSchema.partial();

export const emailSearchSchema = z.object({
  q: z.string().optional(),
  recipientEmail: z.string().optional(),
  senderEmail: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  status: z.enum(['scheduled', 'processing', 'sent', 'failed']).optional(),
  campaignId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['scheduled', 'processing', 'sent', 'failed']).optional(),
});
