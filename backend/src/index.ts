import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDatabase } from './db/prisma';
import { scheduleSlaScanJob } from './jobs/queue';
import { initSlaWorker } from './jobs/worker';

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  // 1. Connect to PostgreSQL
  await connectDatabase();

  // 2. Initialize BullMQ Worker & Recurring Cron Scanner
  try {
    initSlaWorker();
    await scheduleSlaScanJob();
    console.log('[BullMQ] Background worker and repeating SLA scanner initialized.');
  } catch (err: any) {
    console.warn('[BullMQ] Notice: Worker initialization warning (will retry with Redis):', err.message);
  }

  // 3. Start Express Server
  app.listen(PORT, () => {
    console.log(`[Bottleneck Backend] Server listening on port ${PORT}`);
    console.log(`[Bottleneck Backend] Healthcheck at http://localhost:${PORT}/health`);
  });
};

startServer();
