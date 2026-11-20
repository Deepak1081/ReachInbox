export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  isDefault: boolean;
  createdAt: string;
}

export interface ScheduledEmailItem {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  bullJobId?: string | null;
  errorMessage?: string | null;
  etherealUrl?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    email: string;
    displayName: string;
  };
  campaign?: {
    id: string;
    subject: string;
    startTime: string;
  };
}

export interface EmailStats {
  total: number;
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  hourlyQuotaRemaining: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  teamId?: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipientEmails: string[];
  senderId: string;
  startTime?: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}
