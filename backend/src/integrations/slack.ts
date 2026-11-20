import axios from 'axios';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    name: string;
    id: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  error?: string;
}

class SlackService {
  /**
   * Generates the Slack OAuth 2.0 authorization URL
   */
  getAuthorizationUrl(userId: string): string {
    const scopes = ['chat:write', 'chat:write.public', 'channels:read', 'incoming-webhook'];
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: scopes.join(','),
      redirect_uri: env.SLACK_REDIRECT_URI,
      state: userId, // Pass userId in state to link integration on callback
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for permanent access token
   */
  async handleOAuthCallback(code: string, userId: string): Promise<{ success: boolean; teamName?: string; error?: string }> {
    try {
      const response = await axios.post<SlackOAuthResponse>(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: env.SLACK_REDIRECT_URI,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const data = response.data;
      if (!data.ok || !data.access_token || !data.team) {
        logger.error('Slack OAuth token exchange failed:', data.error);
        return { success: false, error: data.error || 'Failed to exchange Slack OAuth token' };
      }

      const encryptedToken = encrypt(data.access_token);

      // Upsert Slack integration record
      await prisma.slackIntegration.upsert({
        where: { userId },
        create: {
          userId,
          accessToken: encryptedToken,
          teamId: data.team.id,
          teamName: data.team.name,
          incomingWebhookUrl: data.incoming_webhook?.url || null,
          defaultChannelId: data.incoming_webhook?.channel_id || null,
          connected: true,
        },
        update: {
          accessToken: encryptedToken,
          teamId: data.team.id,
          teamName: data.team.name,
          incomingWebhookUrl: data.incoming_webhook?.url || null,
          defaultChannelId: data.incoming_webhook?.channel_id || null,
          connected: true,
          updatedAt: new Date(),
        },
      });

      logger.info(`Slack successfully connected for user ${userId} to team ${data.team.name}`);
      return { success: true, teamName: data.team.name };
    } catch (error: any) {
      logger.error('Error exchanging Slack code:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect Slack for a user
   */
  async disconnect(userId: string): Promise<boolean> {
    try {
      const integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });

      if (!integration) return false;

      // Revoke token if possible
      try {
        const token = decrypt(integration.accessToken);
        await axios.post(
          'https://slack.com/api/auth.revoke',
          new URLSearchParams({ token }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (revokeErr: any) {
        logger.warn('Failed to revoke Slack token with API, deleting local record:', revokeErr.message);
      }

      await prisma.slackIntegration.delete({
        where: { userId },
      });

      return true;
    } catch (error: any) {
      logger.error('Error disconnecting Slack:', error.message);
      return false;
    }
  }

  /**
   * Get connection status for a user
   */
  async getStatus(userId: string): Promise<{ connected: boolean; teamName?: string; teamId?: string }> {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.connected) {
      return { connected: false };
    }

    return {
      connected: true,
      teamName: integration.teamName,
      teamId: integration.teamId,
    };
  }

  /**
   * Send Rate Limit Exceeded notification to Slack
   * Uses Redis deduplication key so workers don't spam Slack repeatedly for the same window.
   */
  async sendHourlyLimitAlert(params: {
    userId: string;
    senderId: string;
    senderEmail: string;
    hourlyLimit: number;
    hourWindow: string;
    delayedEmailsCount: number;
    nextScheduledTime: Date;
  }): Promise<boolean> {
    const { userId, senderId, senderEmail, hourlyLimit, hourWindow, delayedEmailsCount, nextScheduledTime } = params;

    // Deduplication key in Redis: only 1 alert per sender per hour window
    const dedupeKey = `slack:notified:${senderId}:${hourWindow}`;
    const alreadyNotified = await redis.get(dedupeKey);
    if (alreadyNotified) {
      logger.debug(`Slack notification suppressed (already sent for window ${hourWindow})`);
      return false;
    }

    // Set deduplication lock with TTL of 3600 seconds (1 hour)
    await redis.set(dedupeKey, '1', 'EX', 3600);

    // Retrieve Slack integration for the user
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.connected) {
      logger.debug(`Slack is not connected for user ${userId}; skipping notification`);
      return false;
    }

    try {
      const accessToken = decrypt(integration.accessToken);

      const messageBlocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Sending Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender account *${senderEmail}* has reached its hourly rate limit of *${hourlyLimit} emails/hour*.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Hour Window:*\n\`${hourWindow}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Delayed Emails:*\n*${delayedEmailsCount}* emails`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Sending Window:*\n<!date^${Math.floor(nextScheduledTime.getTime() / 1000)}^{date_num} {time_secs}|${nextScheduledTime.toUTCString()}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nRescheduled Automatically`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '📧 _ReachInbox Job Scheduler coordinated delivery to avoid provider penalties._',
            },
          ],
        },
      ];

      // Try sending via incoming webhook URL if available, else via chat.postMessage
      if (integration.incomingWebhookUrl) {
        await axios.post(integration.incomingWebhookUrl, {
          blocks: messageBlocks,
        });
      } else {
        await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: integration.defaultChannelId || '#general',
            blocks: messageBlocks,
            text: `Rate limit reached for ${senderEmail}: ${hourlyLimit} emails/hour limit hit.`,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      logger.info(`Slack alert sent successfully for sender ${senderEmail} (window: ${hourWindow})`);
      return true;
    } catch (error: any) {
      logger.error('Failed to dispatch Slack rate limit notification:', error.message);
      // Non-blocking: queue processing continues normally
      return false;
    }
  }
}

export const slackService = new SlackService();
