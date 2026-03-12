import mongoose from "mongoose";

const { Schema } = mongoose;

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

    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
      index: true,
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
