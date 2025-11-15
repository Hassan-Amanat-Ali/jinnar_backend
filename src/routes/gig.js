import express from 'express';
import {getGigById ,createGig, getGigs , getMyGigs , deleteGig , updateGig } from '../controllers/gigController.js';
import { protect } from '../middleware/auth.js';
import { uploadGigImageMW } from '../middleware/upload.js';

const router = express.Router();

router.post('/create', protect, uploadGigImageMW, createGig);
router.get('/', getGigs);
router.get('/:id', getGigById);

// ✅ NEW: Seller routes
router.get('/my-gigs', protect, getMyGigs);
router.put('/update/:id', protect, uploadGigImageMW, updateGig);
router.delete('/delete/:id', protect, deleteGig);

export default router;