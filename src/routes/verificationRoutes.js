import express from 'express';
import { startVerification } from '../controllers/verificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected route to start verification
// Assuming verifyToken middleware sets req.user
router.post('/start', protect, startVerification);

export default router;
