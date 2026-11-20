import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { checkDatabaseConnection, prisma } from './config/prisma.js';
import { checkRedisConnection, redis } from './config/redis.js';
import { elasticsearchService } from './integrations/elasticsearch.js';
import { initEmailWorker, closeEmailWorker } from './workers/emailWorker.js';
import { RecoveryService } from './services/recoveryService.js';

async function bootstrap() {
  logger.info('Starting ReachInbox Full-Stack Email Job Scheduler Backend...');

  // 1. Verify Database Connection
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    logger.warn('PostgreSQL database is currently unreachable. Make sure Docker container is running.');
  }

  // 2. Verify Redis Connection
  const redisOk = await checkRedisConnection();
  if (!redisOk) {
    logger.warn('Redis is currently unreachable. BullMQ queues require Redis to function.');
  }

  // 3. Initialize Elasticsearch index
  await elasticsearchService.initIndex();

  // 4. Initialize BullMQ Workers
  initEmailWorker();

  // 5. Run Queue Reconciliation and Restart Recovery
  if (dbOk && redisOk) {
    await RecoveryService.reconcileAndRecoverJobs();
  }

  // 6. Start HTTP Server
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`API Base URL: ${env.BACKEND_URL}/api`);
    logger.info(`Bull-Board Queue Dashboard: ${env.BACKEND_URL}/api/admin/queues`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Commencing graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await closeEmailWorker();
        await redis.quit();
        await prisma.$disconnect();
        logger.info('All connections cleanly terminated. Exiting process.');
        process.exit(0);
      } catch (err: any) {
        logger.error('Error during graceful shutdown:', err.message);
        process.exit(1);
      }
    });

    // Force exit after 10s if hanging
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
