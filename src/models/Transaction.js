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

    amount: {
      type: Number,
      required: true,
      min: 0,
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
