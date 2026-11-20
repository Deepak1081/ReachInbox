import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';

export class CampaignController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { subject, body, delayBetweenEmails, hourlyLimit, startTime } = req.body;
      const userId = req.user!.id;

      const campaign = await prisma.emailCampaign.create({
        data: {
          userId,
          subject,
          body,
          delayBetweenEmails: delayBetweenEmails || 2000,
          hourlyLimit: hourlyLimit || 200,
          startTime: startTime ? new Date(startTime) : new Date(),
          status: 'scheduled',
        },
      });

      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const campaigns = await prisma.emailCampaign.findMany({
        where: { userId },
        include: {
          _count: {
            select: { emails: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const campaign = await prisma.emailCampaign.findFirst({
        where: { id, userId },
        include: {
          emails: {
            orderBy: { scheduledAt: 'asc' },
          },
        },
      });

      if (!campaign) {
        res.status(404).json({ success: false, error: 'Campaign not found' });
        return;
      }

      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }
}
