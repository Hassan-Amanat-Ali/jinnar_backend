import mongoose from "mongoose";

const { Schema } = mongoose;

const rewardReviewHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: ["rejected"],
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    at: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  { _id: false },
);

const rewardSchema = new Schema(
  {
    drawId: {
      type: Schema.Types.ObjectId,
      ref: "Draw",
      required: true,
      index: true,
    },

    rank: {
      type: Number,
      required: true,
      min: 1,
    },

    rewardType: {
      type: String,
      enum: ["cash", "merchandise"],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    winnerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvalNote: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
      index: true,
    },

    walletTransactionId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    reviewHistory: {
      type: [rewardReviewHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Prevent duplicate ranks inside same draw
 * Example: Draw A cannot have two rank 1 rewards
 */
rewardSchema.index({ drawId: 1, rank: 1 }, { unique: true });

/**
 * Fast lookup for winners in a draw
 */
rewardSchema.index({ drawId: 1, winnerUserId: 1 });
rewardSchema.index({ drawId: 1, approvalStatus: 1, rank: 1 });

/**
 * Assign winner method
 */
rewardSchema.methods.assignWinner = function (userId) {
  this.winnerUserId = userId;
  return this.save();
};

/**
 * Mark reward as paid
 */
rewardSchema.methods.markAsPaid = function () {
  if (!this.winnerUserId) {
    throw new Error("Cannot mark reward as paid without a winner.");
  }
  this.status = "paid";
  return this.save();
};

export default mongoose.model("Reward", rewardSchema);
