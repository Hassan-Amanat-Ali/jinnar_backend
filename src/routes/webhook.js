// routes/webhook.js
import express from 'express';
import User from '../models/User.js';
import JobRequest from '../models/JobRequest.js';

const router = express.Router();

router.post('/flutterwave', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (!signature || signature !== process.env.FLW_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  // Parse JSON safely from raw buffer
  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch (error) {
    return res.status(400).send('Invalid JSON' + error);
  }

  const { event, data } = payload;

  // ─────────────────────────────────────────
  // 1️⃣ WALLET TOP-UP (charge.completed)
  // ─────────────────────────────────────────
  if (event === 'charge.completed' && data.status === 'successful') {
    const tx_ref = data.tx_ref;
    const amount = Number(data.amount);

    const user = await User.findOne({ 'wallet.transactions.flutterwaveTxRef': tx_ref });
    if (user) {
      const transaction = user.wallet.transactions.find(t => t.flutterwaveTxRef === tx_ref);
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        user.wallet.balance += amount;
        await user.save();
        console.log(`✅ Wallet credited: ${amount} to user ${user._id}`);
      }
    }

    // ─────────────────────────────────────────
    // 2️⃣ JOB PAYMENT (Release to seller instantly OR escrow)
    // ─────────────────────────────────────────
    const job = await JobRequest.findOne({ flutterwaveTxRef: tx_ref });
    if (job && job.paymentStatus === 'pending') {
      job.paymentStatus = 'paid';
      job.status = 'in_progress'; // or 'completed' if instant model
      await job.save();

      const seller = await User.findById(job.acceptedBy); // or sellerId
      if (seller) {
        seller.wallet.balance += amount;
        seller.wallet.transactions.push({
          type: 'order_earned',
          amount,
          paymentMethod: 'flutterwave',
          orderId: job._id,
          status: 'completed',
          flutterwaveTxRef: tx_ref
        });

        seller.notifications.push({
          type: 'payment_received',
          content: `You received ${amount} for job "${job.title}"`,
          jobId: job._id
        });

        await seller.save();
      }

      const buyer = await User.findById(job.buyerId);
      if (buyer) {
        buyer.notifications.push({
          type: 'payment_success',
          content: `Your payment for "${job.title}" was successful`,
          jobId: job._id
        });
        await buyer.save();
      }

      console.log(`✅ Job payment confirmed | Job: ${job._id} | Amount: ${amount}`);
    }

    return res.sendStatus(200);
  }

  // ─────────────────────────────────────────
  // 3️⃣ WITHDRAWAL STATUS (transfer.completed)
  // ─────────────────────────────────────────
  if (event === 'transfer.completed') {
    const { reference, status } = data; // reference == tx_ref

    const user = await User.findOne({ 'wallet.transactions.flutterwaveTxRef': reference });
    if (user) {
      const transaction = user.wallet.transactions.find(t => t.flutterwaveTxRef === reference);

      if (status === 'SUCCESSFUL') {
        transaction.status = 'completed';
      } else {
        // refund
        transaction.status = 'failed';
        user.wallet.balance += Math.abs(transaction.amount);
      }
      await user.save();
      console.log(`💸 Withdrawal ${status} | Ref: ${reference}`);
    }
    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

export default router;
