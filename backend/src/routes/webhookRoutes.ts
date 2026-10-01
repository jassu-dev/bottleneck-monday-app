import { Router } from 'express';
import { verifyMondayWebhook } from '../middleware/mondayAuth';
import { handleMondayWebhook } from '../controllers/webhookController';

const router = Router();

// Endpoint for monday.com change_column_value webhooks
router.post('/monday', verifyMondayWebhook, handleMondayWebhook);

export default router;
