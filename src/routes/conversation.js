import express from 'express';
import { startConversation } from '../controllers/conversationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, startConversation);

export default router;