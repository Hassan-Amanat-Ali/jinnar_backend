// models/Wallet.js
import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'order_earned', 'order_paid'],
    required: true
  },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentMethod: String,
  flutterwaveTxRef: String,
  flutterwaveFlwRef: String,
  description: String,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRequest' },
  createdAt: { type: Date, default: Date.now }
});

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: { type: Number, default: 0 },
  transactions: [walletTransactionSchema]
}, { timestamps: true });

walletSchema.index({ userId: 1 });

export default mongoose.model('Wallet', walletSchema);