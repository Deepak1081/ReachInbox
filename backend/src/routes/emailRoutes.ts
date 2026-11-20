import { Router } from 'express';
import { EmailController } from '../controllers/emailController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/schedule', EmailController.schedule);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.get('/search', EmailController.search);
router.get('/stats', EmailController.getStats);
router.get('/:id', EmailController.getById);

export default router;
