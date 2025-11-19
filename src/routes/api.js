import express from 'express';
import authRoutes from './auth.js';
import gigRoutes from './gig.js';
import userRoutes from './user.js'
import imagesRoutes from './image.js'
 import paymentRoutes from './payment.js'
 import payoutRoutes from './payout.js'
import notificationRoutes from './notification.js'
import jobRequestRoutes from './order.js'
 import walletRoutes from './wallet.js'
import uploadRoutes from './uploadRoutes.js'
import pawaPayCallbackRoutes from "./pawapayCallback.js";
import workerRoutes from './workers.js'
import pawapayCallbackRoutes from "./pawapayCallback.js"
import chatRoutes from './chat.js'
import { getSkills } from '../controllers/gigController.js';


const router = express.Router();

router.use('/auth', authRoutes);
router.use('/gigs', gigRoutes)
router.use('/user', userRoutes);
router.use('/images', imagesRoutes)
 router.use('/payment' , paymentRoutes)
router.use('/notifications' , notificationRoutes)
router.use('/orders', jobRequestRoutes)
 router.use('/wallet' , walletRoutes)
router.use('/upload', uploadRoutes)
router.use('/payout' , payoutRoutes)
router.use("/api/webhooks", pawaPayCallbackRoutes);
router.use('/workers', workerRoutes );
router.use('/checkout' , chatRoutes)
router.use("/pawapay", pawapayCallbackRoutes);
router.use('/chat', chatRoutes)

router.use('/categories' , getSkills)





export default router;  