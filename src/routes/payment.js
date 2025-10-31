// import express from 'express';
// import { initializeTopup, payForOrder, withdrawFunds, getWallet,createPayment } from '../controllers/paymentController.js';
// import { protect } from '../middleware/auth.js';
// import webhookRouter from './webhook.js';

// const router = express.Router();

// router.post('/topup', protect, initializeTopup);
// router.post('/pay-order', protect, payForOrder);
// router.post('/withdraw', protect, withdrawFunds);
// router.get('/wallet', protect, getWallet);
// router.post('/create-payment',createPayment , webhookRouter);

// // Webhook
// router.use('/webhook', webhookRouter);

// export default router;