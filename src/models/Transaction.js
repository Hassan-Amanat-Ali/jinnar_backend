import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    // enum: [
    //   "wallet_topup",     // User added money via Flutterwave
    //   "withdrawal",       // User withdrew funds to bank/mobile money
    //   "order_payment",    // User paid for a job/service
    //   "order_earning",    // Seller received money from a job
    //   "refund"            // Money refunded back to user
    // ],
    required: true,
  },

  amount: {               // Always a positive number
    type: Number,
    required: true,
    min: 0
  },

  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },

  paymentMethod: {        // e.g. mpesa, card, bank_transfer, paypal
    type: String,
    default: null
  },

  // ✅ Store Flutterwave references (for webhook verification & refund)
  flutterwaveTxRef: { type: String, default: null },   // tx_ref we sent
  flutterwaveFlwRef: { type: String, default: null },  // flw_ref from Flutterwave

  // ✅ Optional job/service reference
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobRequest",
    default: null
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now,
  }
}, { _id: true });


export default mongoose.model("Transaction", transactionSchema);
