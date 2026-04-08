import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "refund"],
      required: true,
    },

    // Amount in base currency (USD). This is the authoritative financial value.
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Original amount in local currency (e.g. KES, PKR) as sent/received via pawaPay
    localAmount: {
      type: Number,
      default: null,
    },

    // FX rate used at time of transaction: 1 USD = <fxRate> <currency>
    fxRate: {
      type: Number,
      default: null,
    },

    // Base currency for the `amount` field — always USD
    baseCurrency: {
      type: String,
      default: "USD",
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    // whether the transaction's effect on wallet balance has been applied
    applied: {
      type: Boolean,
      default: false,
    },

    paymentMethod: {
      type: String,
      default: null,
    },

    // Pawapay specific fields
    correspondent: { type: String, default: null },
    correspondentIds: { type: Object, default: null },
    country: { type: String, default: null },
    currency: { type: String, default: null },
    metadata: { type: Object, default: null },

    pawapayDepositId: { type: String, index: true, sparse: true },
    pawapayPayoutId: { type: String, index: true, sparse: true },
    providerTransactionId: { type: String, default: null, sparse: true },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobRequest",
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Transaction", transactionSchema);
