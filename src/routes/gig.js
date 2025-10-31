import express from 'express';
import { createGig, getGigs , getMyGigs , deleteGig , updateGig } from '../controllers/gigController.js';
import { protect } from '../middleware/auth.js';
import { uploadGigImage } from '../middleware/upload.js';

const router = express.Router();

router.post('/create', protect, uploadGigImage, createGig);
router.get('/', getGigs);
// ✅ NEW: Seller routes
router.get('/my-gigs', protect, getMyGigs);
router.put('/update/:id', protect, uploadGigImage, updateGig);
router.delete('/delete/:id', protect, deleteGig);

export default router;