import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { triggerScanNow } from '../jobs/queue';
import { invalidateBoardCache } from '../cache/redis';

const router = Router();

/**
 * GET /api/slas/:boardId
 * List all configured SLA rules for a board
 */
router.get('/:boardId', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const rules = await prisma.sLARule.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json({ success: true, rules });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch SLA rules', message: error.message });
  }
});

/**
 * POST /api/slas
 * Create or update an SLA rule for a board and status
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      boardId,
      statusLabel,
      maxDurationHours,
      actionType,
      targetGroupId,
      targetStatus,
      targetRole,
      active,
    } = req.body;

    if (!boardId || !statusLabel || maxDurationHours === undefined) {
      res.status(400).json({ error: 'boardId, statusLabel, and maxDurationHours are required' });
      return;
    }

    const hours = parseFloat(String(maxDurationHours));
    const minutes = hours * 60;

    const rule = await prisma.sLARule.upsert({
      where: {
        boardId_statusLabel: {
          boardId: String(boardId),
          statusLabel: String(statusLabel),
        },
      },
      update: {
        maxDurationHours: hours,
        maxDurationMinutes: minutes,
        actionType: actionType || 'NOTIFY',
        targetGroupId: targetGroupId || null,
        targetStatus: targetStatus || null,
        targetRole: targetRole || 'ASSIGNEE',
        active: active !== undefined ? Boolean(active) : true,
      },
      create: {
        boardId: String(boardId),
        statusLabel: String(statusLabel),
        maxDurationHours: hours,
        maxDurationMinutes: minutes,
        actionType: actionType || 'NOTIFY',
        targetGroupId: targetGroupId || null,
        targetStatus: targetStatus || null,
        targetRole: targetRole || 'ASSIGNEE',
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    await invalidateBoardCache(String(boardId));

    res.status(200).json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save SLA rule', message: error.message });
  }
});

/**
 * DELETE /api/slas/:id
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sLARule.delete({ where: { id } });
    await invalidateBoardCache(deleted.boardId);
    res.status(200).json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete SLA rule', message: error.message });
  }
});

// -------------------------------------------------------------
// Time Tracking Automation Rules Endpoints
// -------------------------------------------------------------

/**
 * GET /api/slas/time-tracking/:boardId
 */
router.get('/time-tracking/:boardId', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const rules = await prisma.timeTrackingRule.findMany({
      where: { boardId },
      orderBy: { thresholdMinutes: 'asc' },
    });
    res.status(200).json({ success: true, rules });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch time tracking rules', message: error.message });
  }
});

/**
 * POST /api/slas/time-tracking
 */
router.post('/time-tracking', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      boardId,
      columnId,
      thresholdMinutes,
      actionType,
      targetGroupId,
      targetStatus,
      targetRole,
      customMessage,
      active,
    } = req.body;

    if (!boardId || thresholdMinutes === undefined) {
      res.status(400).json({ error: 'boardId and thresholdMinutes are required' });
      return;
    }

    const rule = await prisma.timeTrackingRule.create({
      data: {
        boardId: String(boardId),
        columnId: columnId || null,
        thresholdMinutes: parseInt(String(thresholdMinutes), 10),
        actionType: actionType || 'NOTIFY',
        targetGroupId: targetGroupId || null,
        targetStatus: targetStatus || null,
        targetRole: targetRole || 'ASSIGNEE',
        customMessage: customMessage || null,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    res.status(201).json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save time tracking rule', message: error.message });
  }
});

/**
 * POST /api/slas/trigger-scan
 * On-demand trigger for BullMQ worker scan
 */
router.post('/trigger-scan', async (_req: Request, res: Response): Promise<void> => {
  try {
    const jobId = await triggerScanNow('api-trigger');
    res.status(200).json({ success: true, message: 'SLA Scan job enqueued', jobId });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to trigger scan job', message: error.message });
  }
});

export default router;
