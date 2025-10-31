import express from 'express';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js'; // or whatever your auth middleware is called

const router = express.Router();

router.get('/', protect, getNotifications);
router.patch('/read', protect, markAsRead);

export default router;
