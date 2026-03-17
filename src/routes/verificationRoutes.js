import express from 'express';
import { startVerification, syncSession } from '../controllers/verificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected route to start verification
// Assuming verifyToken middleware sets req.user
router.post('/start', protect, startVerification);

// Manual sync route (public for debugging as requested)
router.get('/sync/:sessionId', syncSession);

export default router;
