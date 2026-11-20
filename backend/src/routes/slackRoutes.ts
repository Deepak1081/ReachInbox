import { Router } from 'express';
import { SlackController } from '../controllers/slackController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// OAuth initiation requires auth so we know which user is connecting
router.get('/connect', requireAuth, SlackController.connect);

// Slack OAuth redirect callback
router.get('/callback', SlackController.callback);

// Connection status
router.get('/status', requireAuth, SlackController.getStatus);

// Disconnect
router.post('/disconnect', requireAuth, SlackController.disconnect);

export default router;
