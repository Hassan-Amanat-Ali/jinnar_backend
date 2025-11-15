import express from 'express';
import {getOrderById,
  createJobRequest, getPendingJobRequests, getAvailableJobs,
  acceptJob, declineJob, sendMessage, markMessagesRead,getMyOrders,getOngoingJobRequests,completeOrder,
  uploadDeliverable, rateAndReviewOrder , cancelOrder,getDeclinedJobRequests ,getCancelledJobRequests, getCompletedJobRequests
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

//Get My Orders
router.get('/my-orders', protect, getMyOrders);
router.get('/active-jobs', protect , getOngoingJobRequests);
router.get('/new', protect, getPendingJobRequests);
router.get('/completed' , protect ,getCompletedJobRequests )
router.get('/cancelled' , protect , getCancelledJobRequests)
router.get('/:id', protect, getOrderById);

// Buyer
router.post('/create', protect, createJobRequest);
router.patch('/cancel', protect, cancelOrder);
router.post('/complete' , protect, completeOrder)

// Seller
router.get('/available', protect, getAvailableJobs);
router.post('/accept', protect, acceptJob);
router.post('/decline', protect, declineJob);
router.get('/declined', protect , getDeclinedJobRequests)

// Chat
router.post('/message', protect, sendMessage);
router.post('/read', protect, markMessagesRead);

// Delivery & Payment
router.post('/deliver', protect, uploadDeliverable);
router.post('/review', protect, rateAndReviewOrder);



export default router;