import { Router } from 'express';
import { SenderController } from '../controllers/senderController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', SenderController.list);
router.post('/', SenderController.create);
router.patch('/:id', SenderController.update);
router.delete('/:id', SenderController.delete);

export default router;
