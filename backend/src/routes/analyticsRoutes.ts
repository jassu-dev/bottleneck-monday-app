import { Router, Request, Response } from 'express';
import analyticsService from '../services/analytics';
import { invalidateBoardCache } from '../cache/redis';

const router = Router();

/**
 * GET /api/analytics/:boardId/time-in-status
 * Returns average and total time spent in each status
 */
router.get('/:boardId/time-in-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const data = await analyticsService.getTimeInStatus(boardId);
    res.status(200).json({ success: true, boardId, data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to calculate time in status', message: error.message });
  }
});

/**
 * GET /api/analytics/:boardId/cycle-lead-time
 * Returns Cycle Time and Lead Time performance metrics
 */
router.get('/:boardId/cycle-lead-time', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const data = await analyticsService.getCycleAndLeadTime(boardId);
    res.status(200).json({ success: true, boardId, metrics: data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to calculate cycle/lead time', message: error.message });
  }
});

/**
 * GET /api/analytics/:boardId/stuck-hub
 * Returns actionable stuck task hub items with SLA breach calculations
 */
router.get('/:boardId/stuck-hub', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const items = await analyticsService.getStuckHubItems(boardId);
    res.status(200).json({
      success: true,
      boardId,
      totalStuckItems: items.length,
      breachedCount: items.filter((i) => i.slaBreached).length,
      warningCount: items.filter((i) => i.slaWarning).length,
      items,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve stuck hub items', message: error.message });
  }
});

/**
 * POST /api/analytics/:boardId/refresh-cache
 * Invalidate Redis cache on demand
 */
router.post('/:boardId/refresh-cache', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    await invalidateBoardCache(boardId);
    res.status(200).json({ success: true, message: `Cache invalidated for board ${boardId}` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to clear cache', message: error.message });
  }
});

export default router;
