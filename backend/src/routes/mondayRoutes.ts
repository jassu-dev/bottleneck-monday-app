import { Router, Request, Response } from 'express';
import mondayService from '../services/monday';

const router = Router();

/**
 * 1-Click Nudge Action
 * Posts an update to the stuck item tagging/notifying the assignee
 */
router.post('/nudge', async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, message, assigneeName } = req.body;

    if (!itemId) {
      res.status(400).json({ error: 'itemId is required' });
      return;
    }

    const defaultNudgeMessage = `⚠️ **Bottleneck SLA Alert**: This item has exceeded its target SLA duration. Please review current progress or update the status!`;
    const bodyContent = message || defaultNudgeMessage;

    const result = await mondayService.createUpdate(String(itemId), bodyContent);

    console.log(`[1-Click Nudge] Sent notification to item ${itemId} for assignee ${assigneeName || 'team'}`);

    res.status(200).json({
      success: true,
      message: 'Nudge sent successfully to item pulse',
      updateId: result.id,
    });
  } catch (error: any) {
    console.error('[1-Click Nudge Error]:', error);
    res.status(500).json({
      error: 'Failed to send nudge update',
      message: error.message,
    });
  }
});

/**
 * Fetch board metadata (columns, groups, settings)
 */
router.get('/boards/:boardId', async (req: Request, res: Response): Promise<void> => {
  try {
    const boardId = String(req.params.boardId);
    const board = await mondayService.getBoardDetails(boardId);
    res.status(200).json({ success: true, board });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch board details', message: error.message });
  }
});

/**
 * Fetch item details
 */
router.get('/items/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = String(req.params.itemId);
    const item = await mondayService.getItem(itemId);
    res.status(200).json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch item details', message: error.message });
  }
});

export default router;
