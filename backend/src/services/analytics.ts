import prisma from '../db/prisma';
import { getCachedData, setCachedData } from '../cache/redis';

export interface StatusDurationSummary {
  status: string;
  averageHours: number;
  totalHours: number;
  itemCount: number;
  minHours: number;
  maxHours: number;
}

export interface CycleLeadTimeMetrics {
  averageLeadTimeHours: number;
  averageCycleTimeHours: number;
  completedItemsCount: number;
  fastestLeadTimeHours: number;
  longestLeadTimeHours: number;
}

export interface StuckItemDetails {
  itemId: string;
  boardId: string;
  currentStatus: string;
  timeInStatusHours: number;
  timeInStatusFormatted: string;
  maxSlaHours: number | null;
  slaBreached: boolean;
  slaWarning: boolean;
  breachPercentage: number;
  exceededByHours: number;
  lastStatusChange: string;
}

const TERMINAL_STATUSES = ['done', 'completed', 'resolved', 'closed', 'finished'];
const IN_PROGRESS_STATUSES = ['working on it', 'in progress', 'in development', 'doing', 'active'];

/**
 * Format hours into human-readable string: e.g. "2d 4h 30m"
 */
export const formatDuration = (hours: number): string => {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  const remainingMinutes = Math.round((hours * 60) % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (remainingHours > 0) parts.push(`${remainingHours}h`);
  if (remainingMinutes > 0 && days === 0) parts.push(`${remainingMinutes}m`);

  return parts.length > 0 ? parts.join(' ') : '0m';
};

export class AnalyticsService {
  /**
   * Calculate average and total time items spend in each status across a board.
   * Cached in Redis for 10 minutes.
   */
  async getTimeInStatus(boardId: string): Promise<StatusDurationSummary[]> {
    const cacheKey = `analytics:time-in-status:board:${boardId}`;
    const cached = await getCachedData<StatusDurationSummary[]>(cacheKey);
    if (cached) return cached;

    // Fetch all status events for this board ordered by item and time
    const events = await prisma.statusEvent.findMany({
      where: { boardId },
      orderBy: [{ itemId: 'asc' }, { changedAt: 'asc' }],
    });

    const statusTotals: Record<string, { totalHours: number; count: number; min: number; max: number }> = {};

    // Group events by item
    const eventsByItem: Record<string, typeof events> = {};
    for (const event of events) {
      if (!eventsByItem[event.itemId]) eventsByItem[event.itemId] = [];
      eventsByItem[event.itemId].push(event);
    }

    const now = new Date().getTime();

    for (const itemId in eventsByItem) {
      const itemEvents = eventsByItem[itemId];

      for (let i = 0; i < itemEvents.length; i++) {
        const currentEvent = itemEvents[i];
        const status = currentEvent.newStatus;
        const startTime = new Date(currentEvent.changedAt).getTime();

        let endTime = now;
        if (i + 1 < itemEvents.length) {
          endTime = new Date(itemEvents[i + 1].changedAt).getTime();
        }

        const durationHours = Math.max(0, (endTime - startTime) / (1000 * 60 * 60));

        if (!statusTotals[status]) {
          statusTotals[status] = { totalHours: 0, count: 0, min: durationHours, max: durationHours };
        }

        statusTotals[status].totalHours += durationHours;
        statusTotals[status].count += 1;
        statusTotals[status].min = Math.min(statusTotals[status].min, durationHours);
        statusTotals[status].max = Math.max(statusTotals[status].max, durationHours);
      }
    }

    const result: StatusDurationSummary[] = Object.keys(statusTotals).map((status) => {
      const entry = statusTotals[status];
      return {
        status,
        averageHours: entry.count > 0 ? parseFloat((entry.totalHours / entry.count).toFixed(2)) : 0,
        totalHours: parseFloat(entry.totalHours.toFixed(2)),
        itemCount: entry.count,
        minHours: parseFloat(entry.min.toFixed(2)),
        maxHours: parseFloat(entry.max.toFixed(2)),
      };
    });

    // Cache for 10 minutes (600s)
    await setCachedData(cacheKey, result, 600);
    return result;
  }

  /**
   * Calculate Lead Time (creation to completion) and Cycle Time (in progress to completion)
   */
  async getCycleAndLeadTime(boardId: string): Promise<CycleLeadTimeMetrics> {
    const cacheKey = `analytics:cycle-lead-time:board:${boardId}`;
    const cached = await getCachedData<CycleLeadTimeMetrics>(cacheKey);
    if (cached) return cached;

    const events = await prisma.statusEvent.findMany({
      where: { boardId },
      orderBy: [{ itemId: 'asc' }, { changedAt: 'asc' }],
    });

    const eventsByItem: Record<string, typeof events> = {};
    for (const event of events) {
      if (!eventsByItem[event.itemId]) eventsByItem[event.itemId] = [];
      eventsByItem[event.itemId].push(event);
    }

    let totalLeadHours = 0;
    let totalCycleHours = 0;
    let completedCount = 0;
    let fastestLead = Infinity;
    let longestLead = 0;

    for (const itemId in eventsByItem) {
      const itemEvents = eventsByItem[itemId];
      if (itemEvents.length === 0) continue;

      const creationTime = new Date(itemEvents[0].changedAt).getTime();
      let startedTime: number | null = null;
      let completedTime: number | null = null;

      for (const ev of itemEvents) {
        const lower = ev.newStatus.toLowerCase().trim();
        if (IN_PROGRESS_STATUSES.includes(lower) && startedTime === null) {
          startedTime = new Date(ev.changedAt).getTime();
        }
        if (TERMINAL_STATUSES.includes(lower)) {
          completedTime = new Date(ev.changedAt).getTime();
        }
      }

      if (completedTime !== null) {
        completedCount++;
        const leadHours = Math.max(0, (completedTime - creationTime) / (1000 * 60 * 60));
        totalLeadHours += leadHours;
        fastestLead = Math.min(fastestLead, leadHours);
        longestLead = Math.max(longestLead, leadHours);

        if (startedTime !== null) {
          const cycleHours = Math.max(0, (completedTime - startedTime) / (1000 * 60 * 60));
          totalCycleHours += cycleHours;
        } else {
          totalCycleHours += leadHours;
        }
      }
    }

    const metrics: CycleLeadTimeMetrics = {
      averageLeadTimeHours: completedCount > 0 ? parseFloat((totalLeadHours / completedCount).toFixed(2)) : 0,
      averageCycleTimeHours: completedCount > 0 ? parseFloat((totalCycleHours / completedCount).toFixed(2)) : 0,
      completedItemsCount: completedCount,
      fastestLeadTimeHours: completedCount > 0 ? parseFloat(fastestLead.toFixed(2)) : 0,
      longestLeadTimeHours: completedCount > 0 ? parseFloat(longestLead.toFixed(2)) : 0,
    };

    await setCachedData(cacheKey, metrics, 600);
    return metrics;
  }

  /**
   * Actionable "Stuck Task Hub"
   * Detects items actively sitting in statuses exceeding configured SLAs.
   */
  async getStuckHubItems(boardId: string): Promise<StuckItemDetails[]> {
    const cacheKey = `analytics:stuck-hub:board:${boardId}`;
    const cached = await getCachedData<StuckItemDetails[]>(cacheKey);
    if (cached) return cached;

    // Load SLA rules for this board
    const rules = await prisma.sLARule.findMany({
      where: { boardId, active: true },
    });
    const ruleMap = new Map<string, number>();
    for (const rule of rules) {
      ruleMap.set(rule.statusLabel.toLowerCase().trim(), rule.maxDurationHours);
    }

    // Get latest status event for each item
    const allEvents = await prisma.statusEvent.findMany({
      where: { boardId },
      orderBy: { changedAt: 'desc' },
    });

    const latestByItem = new Map<string, typeof allEvents[0]>();
    for (const ev of allEvents) {
      if (!latestByItem.has(ev.itemId)) {
        latestByItem.set(ev.itemId, ev);
      }
    }

    const now = Date.now();
    const stuckItems: StuckItemDetails[] = [];

    for (const [itemId, ev] of latestByItem.entries()) {
      const statusLower = ev.newStatus.toLowerCase().trim();

      // Skip completed items
      if (TERMINAL_STATUSES.includes(statusLower)) continue;

      const durationHours = (now - new Date(ev.changedAt).getTime()) / (1000 * 60 * 60);
      const maxSla = ruleMap.get(statusLower) ?? null;

      let slaBreached = false;
      let slaWarning = false;
      let breachPercentage = 0;
      let exceededByHours = 0;

      if (maxSla !== null && maxSla > 0) {
        breachPercentage = parseFloat(((durationHours / maxSla) * 100).toFixed(1));
        if (durationHours > maxSla) {
          slaBreached = true;
          exceededByHours = parseFloat((durationHours - maxSla).toFixed(2));
        } else if (durationHours >= maxSla * 0.75) {
          slaWarning = true;
        }
      }

      stuckItems.push({
        itemId,
        boardId,
        currentStatus: ev.newStatus,
        timeInStatusHours: parseFloat(durationHours.toFixed(2)),
        timeInStatusFormatted: formatDuration(durationHours),
        maxSlaHours: maxSla,
        slaBreached,
        slaWarning,
        breachPercentage,
        exceededByHours,
        lastStatusChange: ev.changedAt.toISOString(),
      });
    }

    // Prioritize breached items first, then highest breach percentage / duration
    stuckItems.sort((a, b) => {
      if (a.slaBreached && !b.slaBreached) return -1;
      if (!a.slaBreached && b.slaBreached) return 1;
      return b.breachPercentage - a.breachPercentage || b.timeInStatusHours - a.timeInStatusHours;
    });

    // Cache for 5 minutes (300s)
    await setCachedData(cacheKey, stuckItems, 300);
    return stuckItems;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
