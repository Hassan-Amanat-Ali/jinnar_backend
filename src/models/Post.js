import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Engagement Subdocument
 */
const engagementSchema = new Schema(
  {
    likes: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    saves: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Post Schema
 */
const postSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    drawId: {
      type: Schema.Types.ObjectId,
      ref: "Draw",
      required: true,
      index: true,
    },

    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
      index: true,
    },

    platform: {
      type: String,
      enum: ["tiktok", "facebook", "instagram", "youtube"],
      required: true,
      lowercase: true,
      index: true,
    },

    postId: {
      type: String,
      required: true,
      trim: true,
    },

    postId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    engagement: {
      type: engagementSchema,
      default: () => ({}),
    },

    points: {
      type: Number,
      default: 0,
      min: 0,
    },

    verified: {
      type: Boolean,
      default: false,
      index: true,
    },

    fraudFlag: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },

    screenshotUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound Indexes (important for production performance)
 */

// Prevent duplicate platform posts
postSchema.index({ platform: 1, postId: 1 }, { unique: true });

// Fast filtering for draw leaderboard
postSchema.index({ drawId: 1, points: -1 });

// Fast verification queue
postSchema.index({ verified: 1, fraudFlag: 1 });

/**
 * Static method to update engagement safely
 */
postSchema.statics.updateEngagement = async function (
  postId,
  newEngagement
) {
  return this.findByIdAndUpdate(
    postId,
    {
      $set: {
        engagement: newEngagement,
        lastSyncedAt: new Date(),
      },
    },
    { new: true }
  );
};

/**
 * Instance method to calculate points
 * (You can customize formula)
 */
postSchema.methods.calculatePoints = function () {
  const { likes, comments, shares, saves, views } = this.engagement;

  const calculated =
    likes * 1 +
    comments * 2 +
    shares * 3 +
    saves * 2 +
    views * 0.1;

  this.points = Math.floor(calculated);
  return this.points;
};

export default mongoose.model("Posts", postSchema);
