import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

interface TransporterConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EtherealService {
  private transporters: Map<string, Transporter> = new Map();

  /**
   * Get or create a Nodemailer transporter for a given sender
   */
  async getTransporter(sender: {
    id: string;
    email: string;
    displayName: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  }): Promise<Transporter> {
    if (this.transporters.has(sender.id)) {
      return this.transporters.get(sender.id)!;
    }

    let config: TransporterConfig;

    if (sender.smtpUser && sender.smtpPass) {
      config = {
        host: sender.smtpHost || env.ETHEREAL_HOST,
        port: sender.smtpPort || env.ETHEREAL_PORT,
        secure: sender.smtpPort === 465,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPass,
        },
      };
    } else {
      // Auto-generate real Ethereal test account if credentials not configured
      logger.info(`Creating dynamic Ethereal test account for sender ${sender.email}...`);
      const testAccount = await nodemailer.createTestAccount();
      config = {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      };
      logger.info(`Ethereal account created: ${testAccount.user}`);
    }

    const transporter = nodemailer.createTransport({
      ...config,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    this.transporters.set(sender.id, transporter);
    return transporter;
  }

  /**
   * Send email using the sender's transporter
   */
  async sendEmail(
    sender: {
      id: string;
      email: string;
      displayName: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
    },
    recipientEmail: string,
    subject: string,
    body: string
  ): Promise<{
    messageId: string;
    previewUrl: string | false;
    response: string;
  }> {
    const transporter = await this.getTransporter(sender);

    const fromAddress = `"${sender.displayName}" <${sender.email}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${body.replace(/\n/g, '<br/>')}</div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.info(`Email delivered via SMTP to ${recipientEmail} (messageId: ${info.messageId})`);
    if (previewUrl) {
      logger.info(`Ethereal Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
      response: info.response,
    };
  }

  /**
   * Helper to generate a new standalone Ethereal test account
   */
  async createEtherealAccount(): Promise<{
    user: string;
    pass: string;
    smtp: { host: string; port: number; secure: boolean };
    web: string;
  }> {
    const account = await nodemailer.createTestAccount();
    return {
      user: account.user,
      pass: account.pass,
      smtp: account.smtp,
      web: account.web,
    };
  }
}

export const etherealService = new EtherealService();
