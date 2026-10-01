import { Worker, Job } from 'bullmq';
import { redisClient } from '../cache/redis';
import prisma from '../db/prisma';
import mondayService from '../services/monday';
import { SLA_QUEUE_NAME } from './queue';

export class SlaWorkerService {
  /**
   * Scan PostgreSQL for items sitting in a status longer than the SLA rule allows
   */
  async checkSlaBreaches(): Promise<{ breachedCount: number; actionsTaken: number }> {
    console.log('[SlaWorker] Starting SLA breach scan across all boards...');

    const rules = await prisma.sLARule.findMany({
      where: { active: true },
    });

    if (rules.length === 0) {
      console.log('[SlaWorker] No active SLA rules found.');
      return { breachedCount: 0, actionsTaken: 0 };
    }

    let breachedCount = 0;
    let actionsTaken = 0;
    const now = Date.now();

    for (const rule of rules) {
      // Find latest status event for items on this board
      const latestEvents = await prisma.statusEvent.findMany({
        where: {
          boardId: rule.boardId,
          newStatus: {
            equals: rule.statusLabel,
            mode: 'insensitive',
          },
        },
        orderBy: { changedAt: 'desc' },
      });

      // Filter to unique items
      const latestItemMap = new Map<string, typeof latestEvents[0]>();
      for (const ev of latestEvents) {
        if (!latestItemMap.has(ev.itemId)) {
          latestItemMap.set(ev.itemId, ev);
        }
      }

      for (const [itemId, ev] of latestItemMap.entries()) {
        // Verify item is still in this status (no newer status event exists)
        const newerEvent = await prisma.statusEvent.findFirst({
          where: {
            itemId,
            boardId: rule.boardId,
            changedAt: { gt: ev.changedAt },
          },
        });

        if (newerEvent) {
          // Item has moved to a different status
          continue;
        }

        const durationMinutes = (now - new Date(ev.changedAt).getTime()) / (1000 * 60);
        const thresholdMinutes = rule.maxDurationMinutes || rule.maxDurationHours * 60;

        if (durationMinutes > thresholdMinutes) {
          breachedCount++;

          // Check if we have already alerted for this specific rule and item
          const existingAlert = await prisma.alertLog.findFirst({
            where: {
              itemId,
              ruleType: 'SLA_BREACH',
              slaRuleId: rule.id,
            },
          });

          if (existingAlert) {
            // Already alerted, skip duplicate
            continue;
          }

          const durationHours = (durationMinutes / 60).toFixed(1);
          console.warn(`[SlaWorker] Breach detected on item ${itemId} (Status: "${rule.statusLabel}", Duration: ${durationHours}h > Limit: ${rule.maxDurationHours}h)`);

          // 1. Action: NOTIFY
          if (rule.actionType === 'NOTIFY' || !rule.actionType) {
            const body = `🚨 **SLA Breach Alert**: Item has been in **"${rule.statusLabel}"** for **${durationHours} hours** (Configured limit: ${rule.maxDurationHours}h). Escalated to ${rule.targetRole || 'Assignee'}.`;
            await mondayService.createUpdate(itemId, body);
          }

          // 2. Action: ESCALATE_STATUS (e.g. to "Critical" or "Stuck")
          if (rule.actionType === 'ESCALATE_STATUS' && rule.targetStatus) {
            await mondayService.changeStatus(rule.boardId, itemId, ev.columnId || 'status', rule.targetStatus);
            await mondayService.createUpdate(
              itemId,
              `⚠️ **Automated SLA Escalation**: Status changed to "${rule.targetStatus}" due to exceeding the ${rule.maxDurationHours}h limit.`
            );
          }

          // 3. Action: MOVE_GROUP (e.g. to "Urgent")
          if (rule.actionType === 'MOVE_GROUP' && rule.targetGroupId) {
            await mondayService.moveItemToGroup(itemId, rule.targetGroupId);
            await mondayService.createUpdate(
              itemId,
              `📌 **Automated SLA Move**: Moved to Urgent group due to exceeding SLA limit (${durationHours}h in ${rule.statusLabel}).`
            );
          }

          // Record alert in Postgres to prevent spam
          await prisma.alertLog.create({
            data: {
              itemId,
              boardId: rule.boardId,
              ruleType: 'SLA_BREACH',
              slaRuleId: rule.id,
              actionTaken: rule.actionType,
              details: `Exceeded ${rule.maxDurationHours}h in status ${rule.statusLabel} (spent ${durationHours}h)`,
            },
          });

          actionsTaken++;
        }
      }
    }

    return { breachedCount, actionsTaken };
  }

  /**
   * Scan PostgreSQL for running timers exceeding Time Tracking Automation thresholds
   * "X minutes after monday's time tracking column starts running, do this"
   */
  async checkTimeTrackingAutomations(): Promise<{ triggeredCount: number }> {
    console.log('[SlaWorker] Checking active time tracking timers for automation triggers...');

    const rules = await prisma.timeTrackingRule.findMany({
      where: { active: true },
    });

    if (rules.length === 0) {
      return { triggeredCount: 0 };
    }

    let triggeredCount = 0;
    const now = Date.now();

    for (const rule of rules) {
      const runningSessions = await prisma.timeTrackingSession.findMany({
        where: {
          boardId: rule.boardId,
          isRunning: true,
        },
      });

      for (const session of runningSessions) {
        const runningMinutes = (now - new Date(session.startedAt).getTime()) / (1000 * 60);

        if (runningMinutes >= rule.thresholdMinutes) {
          // Check if already notified for this rule & session
          const existingAlert = await prisma.alertLog.findFirst({
            where: {
              itemId: session.itemId,
              ruleType: 'TIME_TRACKING_THRESHOLD',
              timeTrackingRuleId: rule.id,
            },
          });

          if (existingAlert) continue;

          console.log(`[Time Tracking Automation] Item ${session.itemId} timer running for ${runningMinutes.toFixed(0)}m >= Threshold ${rule.thresholdMinutes}m`);

          const customMsg = rule.customMessage ||
            `⏱️ **Time Tracking Alert**: Task timer has been running for **${Math.round(runningMinutes)} minutes** (Threshold: ${rule.thresholdMinutes}m). Role: ${rule.targetRole || 'Assignee'}.`;

          if (rule.actionType === 'NOTIFY' || !rule.actionType) {
            await mondayService.createUpdate(session.itemId, customMsg);
          } else if (rule.actionType === 'ESCALATE_STATUS' && rule.targetStatus) {
            await mondayService.changeStatus(rule.boardId, session.itemId, 'status', rule.targetStatus);
            await mondayService.createUpdate(session.itemId, `${customMsg} Status escalated to "${rule.targetStatus}".`);
          } else if (rule.actionType === 'MOVE_GROUP' && rule.targetGroupId) {
            await mondayService.moveItemToGroup(session.itemId, rule.targetGroupId);
            await mondayService.createUpdate(session.itemId, `${customMsg} Moved to group "${rule.targetGroupId}".`);
          }

          await prisma.alertLog.create({
            data: {
              itemId: session.itemId,
              boardId: rule.boardId,
              ruleType: 'TIME_TRACKING_THRESHOLD',
              timeTrackingRuleId: rule.id,
              actionTaken: rule.actionType,
              details: `Timer ran for ${Math.round(runningMinutes)}m (Threshold: ${rule.thresholdMinutes}m)`,
            },
          });

          triggeredCount++;
        }
      }
    }

    return { triggeredCount };
  }
}

export const slaWorkerService = new SlaWorkerService();

export const initSlaWorker = (): Worker => {
  const worker = new Worker(
    SLA_QUEUE_NAME,
    async (job: Job) => {
      console.log(`[BullMQ Worker] Processing job ${job.name} (ID: ${job.id})`);

      const slaResults = await slaWorkerService.checkSlaBreaches();
      const timerResults = await slaWorkerService.checkTimeTrackingAutomations();

      return {
        timestamp: new Date().toISOString(),
        sla: slaResults,
        timeTracking: timerResults,
      };
    },
    {
      connection: redisClient,
      concurrency: 2,
    }
  );

  worker.on('completed', (job: Job, returnvalue: any) => {
    console.log(`[BullMQ Worker] Job ${job.id} completed:`, JSON.stringify(returnvalue));
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
};
