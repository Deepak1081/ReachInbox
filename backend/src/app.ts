import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';
import { getEmailQueue } from './queues/emailQueue.js';

import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import senderRoutes from './routes/senderRoutes.js';
import slackRoutes from './routes/slackRoutes.js';

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for Bull-Board dashboard UI rendering
  })
);

// CORS configuration (supports localhost, custom domain, and Vercel deployments)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === env.FRONTEND_URL ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// Mount Bull-Board Dashboard for Real-Time Queue Monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(getEmailQueue() as any) as any],
  serverAdapter,
});

// Protect Bull-board dashboard with authentication (or dev bypass)
app.use('/api/admin/queues', requireAuth, serverAdapter.getRouter());

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/slack', slackRoutes);

// Centralized error handler
app.use(errorHandler);

export default app;
