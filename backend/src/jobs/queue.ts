import { Queue } from 'bullmq';
import { redisClient } from '../cache/redis';

export const SLA_QUEUE_NAME = 'sla-monitoring-queue';

export const slaQueue = new Queue(SLA_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const scheduleSlaScanJob = async (): Promise<void> => {
  // Schedule a repeating cron job every 15 minutes
  await slaQueue.add(
    'scan-sla-breaches',
    { triggeredBy: 'cron' },
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      jobId: 'sla-cron-repeating-job',
    }
  );
  console.log('[BullMQ] Scheduled repeating SLA & Time Tracking scan job (every 15m)');
};

export const triggerScanNow = async (source: string = 'manual'): Promise<string> => {
  const job = await slaQueue.add('scan-sla-breaches', { triggeredBy: source, timestamp: Date.now() });
  console.log(`[BullMQ] Enqueued immediate SLA scan job (ID: ${job.id})`);
  return job.id || 'unknown';
};
