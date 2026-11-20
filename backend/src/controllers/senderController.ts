import { Request, Response, NextFunction } from 'express';
import { SenderService } from '../services/senderService.js';
import { createSenderSchema, updateSenderSchema } from '../validators/index.js';

export class SenderController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const senders = await SenderService.listSenders(userId);
      res.json({ success: true, data: senders });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSenderSchema.parse(req.body);
      const userId = req.user!.id;
      const sender = await SenderService.createSender(userId, validated);
      res.status(201).json({ success: true, data: sender });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = req.params.id;
      const validated = updateSenderSchema.parse(req.body);
      const userId = req.user!.id;
      const sender = await SenderService.updateSender(userId, senderId, validated);
      res.json({ success: true, data: sender });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = req.params.id;
      const userId = req.user!.id;
      await SenderService.deleteSender(userId, senderId);
      res.json({ success: true, message: 'Sender deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
