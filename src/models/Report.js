import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The entity being reported (User, Gig, or Order)
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    
    reason: {
      type: String,
      enum: [
        "Spam",
        "Inappropriate Content",
        "Harassment",
        "Scam/Fraud",
        "Poor Service",
        "Did Not Pay",
        "Other",
      ],
      required: [true, "Please provide a reason for reporting"],
    },
    description: {
      type: String,
      required: [true, "Please provide details about the issue"],
      maxlength: 1000,
    },
    attachments: [
      {
        url: String,
      },
    ],

    // Admin Management Fields
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    adminNote: {
      type: String,
      default: null,
    },
    // Internal notes visible only to admins (for history tracking)
    internalNotes: [
      {
        note: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Action taken on this report
    actionTaken: {
      type: String,
      enum: ["none", "warned", "suspended", "resolved", "dismissed"],
      default: "none",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // The Admin who handled it
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);