// models/Wallet.js
import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["deposit", "withdrawal", "order_earned", "order_paid"],
    required: true,
  },
  amount: { type: Number, required: true }, // Always in USD (base currency)
  localAmount: { type: Number, default: null }, // Original local currency amount
  fxRate: { type: Number, default: null }, // 1 USD = X local
  currency: { type: String, default: null }, // Original local currency code
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  paymentMethod: String,
  flutterwaveTxRef: String,
  flutterwaveFlwRef: String,
  // Pawapay specific ids
  pawapayDepositId: { type: String, default: null, index: true, sparse: true },
  pawapayPayoutId: { type: String, default: null, index: true, sparse: true },
  // Link back to Transaction collection entry
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    default: null,
  },
  description: String,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "JobRequest" },
  createdAt: { type: Date, default: Date.now },
});

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: { type: Number, default: 0 }, // Always in USD
    currency: { type: String, default: "USD" }, // Wallet base currency
    onHoldBalance: { type: Number, default: 0 }, // Funds reserved for pending payouts
    transactions: [walletTransactionSchema],
  },
  { timestamps: true },
);

walletSchema.index({ userId: 1 });

export default mongoose.model("Wallet", walletSchema);
