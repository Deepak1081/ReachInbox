import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/emailService.js';
import { scheduleEmailSchema, emailSearchSchema, paginationSchema } from '../validators/index.js';

export class EmailController {
  /**
   * Schedule emails for a campaign
   * POST /api/emails/schedule
   */
  static async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = scheduleEmailSchema.parse(req.body);
      const userId = req.user!.id;

      const result = await EmailService.scheduleEmails(userId, validatedData);

      res.status(201).json({
        success: true,
        message: `Successfully scheduled ${result.totalScheduled} emails`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get scheduled emails list
   * GET /api/emails/scheduled
   */
  static async getScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const query = paginationSchema.parse(req.query);
      const userId = req.user!.id;

      const result = await EmailService.getScheduledEmails(userId, query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sent emails list (sent or failed)
   * GET /api/emails/sent
   */
  static async getSent(req: Request, res: Response, next: NextFunction) {
    try {
      const query = paginationSchema.parse(req.query);
      const userId = req.user!.id;

      const result = await EmailService.getSentEmails(userId, query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single email by ID
   * GET /api/emails/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const emailId = req.params.id;
      const userId = req.user!.id;

      const email = await EmailService.getEmailById(userId, emailId);

      res.json({
        success: true,
        data: email,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search emails
   * GET /api/emails/search
   */
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const params = emailSearchSchema.parse(req.query);
      const userId = req.user!.id;

      const result = await EmailService.searchEmails(userId, params);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get email statistics for dashboard
   * GET /api/emails/stats
   */
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const stats = await EmailService.getEmailStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
