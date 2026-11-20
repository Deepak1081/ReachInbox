import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { SenderService } from '../services/senderService.js';

export class AuthController {
  /**
   * Redirect user to Google OAuth 2.0 consent screen
   */
  static googleAuthRedirect(req: Request, res: Response) {
    if (
      !env.GOOGLE_CLIENT_ID ||
      env.GOOGLE_CLIENT_ID === 'your-google-client-id.apps.googleusercontent.com' ||
      env.GOOGLE_CLIENT_ID === 'mock-google-client-id'
    ) {
      res.redirect(`${env.FRONTEND_URL}/login?error=google_credentials_missing`);
      return;
    }

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', scopes.join(' '));
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    res.redirect(googleAuthUrl.toString());
  }

  /**
   * Handle Google OAuth 2.0 callback
   */
  static async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        res.status(400).redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
        return;
      }

      // Exchange authorization code for tokens
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token } = tokenResponse.data;

      // Fetch user profile from Google UserInfo endpoint
      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { id: googleId, email, name, picture: avatar } = userInfoResponse.data;

      // Upsert User in PostgreSQL
      let user = await prisma.user.upsert({
        where: { email },
        create: {
          googleId,
          email,
          name: name || email.split('@')[0],
          avatar: avatar || null,
        },
        update: {
          googleId,
          name: name || email.split('@')[0],
          avatar: avatar || null,
          updatedAt: new Date(),
        },
      });

      // Ensure user has at least one default sender configured
      const existingSender = await prisma.sender.findFirst({
        where: { userId: user.id },
      });

      if (!existingSender) {
        await SenderService.createSender(user.id, {
          email: user.email,
          displayName: user.name,
          isDefault: true,
        });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set HTTP-only secure cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend dashboard with token parameter for convenience
      res.redirect(`${env.FRONTEND_URL}/dashboard?token=${token}`);
    } catch (error: any) {
      logger.error('Google OAuth callback failed:', error.message);
      res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }

  /**
   * Developer login for seamless local development and automated evaluation
   */
  static async devLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email || 'developer@reachinbox.ai';
      const name = req.body.name || 'ReachInbox Developer';

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: `dev-user-${Date.now()}`,
            email,
            name,
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
          },
        });

        // Create default Ethereal sender for this dev user
        await SenderService.createSender(user.id, {
          email: user.email,
          displayName: user.name,
          isDefault: true,
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
        token,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user profile
   */
  static async getMe(req: Request, res: Response) {
    res.json({
      success: true,
      user: req.user,
    });
  }

  /**
   * Logout user and clear authentication cookie
   */
  static async logout(req: Request, res: Response) {
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
