export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export type CampaignStatus = 'scheduled' | 'in_progress' | 'completed' | 'paused' | 'cancelled';

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  idempotencyKey: string;
  hourlyLimit?: number;
  delayBetweenEmails?: number;
}

export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  etherealUrl?: string;
  errorMessage?: string;
  rescheduled?: boolean;
  rescheduledFor?: string;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfterMs?: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface EmailSearchParams {
  q?: string;
  recipientEmail?: string;
  senderEmail?: string;
  subject?: string;
  body?: string;
  status?: EmailStatus;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface EmailStats {
  total: number;
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  hourlyQuotaRemaining: number;
}
