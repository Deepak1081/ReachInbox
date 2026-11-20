import { prisma } from '../config/prisma.js';
import { etherealService } from '../integrations/ethereal.js';
import { logger } from '../utils/logger.js';

export class SenderService {
  /**
   * List all senders configured for the user
   */
  static async listSenders(userId: string) {
    return prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  /**
   * Create a new sender. If SMTP credentials are not provided, auto-generate an Ethereal test account!
   */
  static async createSender(
    userId: string,
    data: {
      email: string;
      displayName: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      isDefault?: boolean;
    }
  ) {
    let smtpUser = data.smtpUser;
    let smtpPass = data.smtpPass;
    let smtpHost = data.smtpHost || 'smtp.ethereal.email';
    let smtpPort = data.smtpPort || 587;

    // Auto-create ethereal account if missing
    if (!smtpUser || !smtpPass) {
      logger.info(`Auto-generating Ethereal SMTP test account for sender ${data.email}...`);
      try {
        const testAccount = await etherealService.createEtherealAccount();
        smtpUser = testAccount.user;
        smtpPass = testAccount.pass;
        smtpHost = testAccount.smtp.host;
        smtpPort = testAccount.smtp.port;
        logger.info(`Created Ethereal account: ${testAccount.user}`);
      } catch (err: any) {
        logger.warn('Could not auto-generate Ethereal account, saving with defaults:', err.message);
        smtpUser = 'dev@ethereal.email';
        smtpPass = 'devpass';
      }
    }

    // If marked default, unset existing default
    if (data.isDefault) {
      await prisma.sender.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if user has any existing senders; if not, make this one default
    const existingCount = await prisma.sender.count({ where: { userId } });
    const isDefault = data.isDefault ?? existingCount === 0;

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: data.email.toLowerCase().trim(),
        displayName: data.displayName.trim(),
        smtpHost,
        smtpPort,
        smtpUser: smtpUser!,
        smtpPass: smtpPass!,
        isDefault,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return sender;
  }

  /**
   * Update sender
   */
  static async updateSender(
    userId: string,
    senderId: string,
    data: Partial<{
      displayName: string;
      email: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      isDefault: boolean;
    }>
  ) {
    if (data.isDefault) {
      await prisma.sender.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.sender.update({
      where: { id: senderId, userId },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return updated;
  }

  /**
   * Delete sender
   */
  static async deleteSender(userId: string, senderId: string) {
    await prisma.sender.delete({
      where: { id: senderId, userId },
    });
    return { success: true };
  }
}
