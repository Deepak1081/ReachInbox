import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Google OAuth endpoints
router.get('/google', AuthController.googleAuthRedirect);
router.get('/google/callback', AuthController.googleCallback);

// Dev login endpoint (for testing/evaluation without Google credentials)
router.post('/dev-login', AuthController.devLogin);

// Current user profile
router.get('/me', requireAuth, AuthController.getMe);

// Logout
router.post('/logout', requireAuth, AuthController.logout);

export default router;
