import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { UserPayload } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      // In development mode: if dev header is sent or no auth is configured, allow fallback dev user
      if (process.env.NODE_ENV === 'development' && (req.headers['x-dev-user'] || !process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'mock-google-client-id')) {
        let devUser = await prisma.user.findFirst();
        if (!devUser) {
          devUser = await prisma.user.create({
            data: {
              googleId: 'dev-google-id-001',
              email: 'developer@reachinbox.ai',
              name: 'ReachInbox Developer',
              avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
            },
          });
        }
        req.user = {
          id: devUser.id,
          email: devUser.email,
          name: devUser.name,
          avatar: devUser.avatar,
        };
        return next();
      }

      res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication token is missing',
      });
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
    
    // Check if user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, avatar: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: User not found',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    logger.warn('Authentication token verification failed:', error.message);
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired token',
    });
  }
}
