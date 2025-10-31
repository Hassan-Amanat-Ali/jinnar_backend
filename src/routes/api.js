import express from 'express';
import authRoutes from './auth.js';
import gigRoutes from './gig.js';
import userRoutes from './user.js'
import imagesRoutes from './image.js'
// import paymentRoutes from './payment.js'
import conversationRoutes from './conversation.js'
import notificationRoutes from './notification.js'
import jobRequestRoutes from './order.js'
import walletRoutes from './wallet.js'


const router = express.Router();

router.use('/auth', authRoutes);
router.use('/gigs', gigRoutes)
router.use('/user', userRoutes);
router.use('/images', imagesRoutes)
// router.use('/payment' , paymentRoutes)
router.use('/conversations' , conversationRoutes)
router.use('/notifications' , notificationRoutes)
router.use('/orders', jobRequestRoutes)
router.use('/wallet' , walletRoutes)



export default router;