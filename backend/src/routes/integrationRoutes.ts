import { Router, Request, Response } from 'express';
import { verifyMondayWebhook } from '../middleware/mondayAuth';

const router = Router();

/**
 * POST /integration/subscribe
 * Called automatically by monday.com when a user adds our Integration Recipe to their board
 */
router.post('/subscribe', verifyMondayWebhook, async (req: Request, res: Response): Promise<void> => {
  try {
    const { payload } = req.body;
    console.log('[Integration Recipe Subscribed]', payload);

    const webhookId = `wh_sub_${Date.now()}`;

    // Return the generated webhook ID to monday.com
    res.status(200).json({
      webhookId,
    });
  } catch (error: any) {
    console.error('[Integration Subscribe Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /integration/unsubscribe
 * Called automatically when a user removes the recipe from their board
 */
router.post('/unsubscribe', verifyMondayWebhook, async (req: Request, res: Response): Promise<void> => {
  try {
    const { payload } = req.body;
    console.log('[Integration Recipe Unsubscribed]', payload);

    res.status(200).json({
      result: 'unsubscribed',
    });
  } catch (error: any) {
    console.error('[Integration Unsubscribe Error]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
