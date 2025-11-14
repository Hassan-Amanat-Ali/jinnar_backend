import express from 'express';
import { getPublicProfile,updateUser  , getMyProfile, updateFcmToken } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Update user route with support for user and gig file uploads
router.post('/update', protect, updateUser);
router.get('/profile', protect, getMyProfile);
router.get('/public/:id', getPublicProfile);
router.post('/fcm-token', protect, updateFcmToken);


export default router;