import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { checkDatabaseConnection, prisma } from '../config/prisma.js';
import { checkRedisConnection, redis } from '../config/redis.js';
import { initEmailWorker, closeEmailWorker } from './emailWorker.js';

async function startWorkerProcess() {
  logger.info('Starting Standalone BullMQ Worker Process...');

  await checkDatabaseConnection();
  await checkRedisConnection();

  initEmailWorker();

  logger.info(`Standalone Email Worker running with concurrency: ${env.WORKER_CONCURRENCY}`);

  const shutdown = async () => {
    logger.info('Shutting down standalone worker...');
    await closeEmailWorker();
    await redis.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorkerProcess().catch((err) => {
  logger.error('Worker startup failure:', err);
  process.exit(1);
});
