import express from 'express';
import { getPublicProfile,updateUser  , getMyProfile } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Update user route with support for user and gig file uploads
router.post('/update', protect, updateUser);
router.get('/profile', protect, getMyProfile);
router.get('/public/:id', getPublicProfile);

export default router;