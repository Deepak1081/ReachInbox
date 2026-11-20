import { Router } from 'express';
import { CampaignController } from '../controllers/campaignController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/', CampaignController.create);
router.get('/', CampaignController.list);
router.get('/:id', CampaignController.getById);

export default router;
