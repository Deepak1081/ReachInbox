import { Request, Response, NextFunction } from 'express';
import { slackService } from '../integrations/slack.js';
import { env } from '../config/env.js';

export class SlackController {
  /**
   * Initiate Slack OAuth authorization flow
   * GET /api/slack/connect
   */
  static connect(req: Request, res: Response) {
    const userId = req.user!.id;
    const authUrl = slackService.getAuthorizationUrl(userId);
    res.redirect(authUrl);
  }

  /**
   * Handle Slack OAuth callback
   * GET /api/slack/callback
   */
  static async callback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state: userId, error } = req.query;

      if (error) {
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${error}`);
        return;
      }

      if (!code || typeof code !== 'string' || !userId || typeof userId !== 'string') {
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=invalid_callback_params`);
        return;
      }

      const result = await slackService.handleOAuthCallback(code, userId);

      if (result.success) {
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack_connected=true&team=${encodeURIComponent(result.teamName || '')}`);
      } else {
        res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(result.error || 'connection_failed')}`);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Slack integration status
   * GET /api/slack/status
   */
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const status = await slackService.getStatus(userId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect Slack integration
   * POST /api/slack/disconnect
   */
  static async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const success = await slackService.disconnect(userId);
      res.json({ success, message: success ? 'Slack disconnected' : 'No active Slack connection found' });
    } catch (error) {
      next(error);
    }
  }
}
