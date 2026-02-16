import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    drawId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Draw",
      required: true,
    },

    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },

    thumbnailUrl: {
      type: String,
      trim: true,
      default: null,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },  

    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewNotes: {
      type: String,
      maxlength: 1000,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// ================= INDEXES =================

// One submission per user per draw
submissionSchema.index(
  { userId: 1, drawId: 1 },
  { unique: true }
);

// Fast filtering
submissionSchema.index({ drawId: 1, status: 1 });
submissionSchema.index({ userId: 1 });
submissionSchema.index({ reviewerId: 1 });
submissionSchema.index({ createdAt: -1 });


// ================= MIDDLEWARE =================

// Automatically set approvedAt when approved
submissionSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "approved") {
      this.approvedAt = new Date();
    }

    if (this.status === "rejected") {
      this.approvedAt = null;
    }
  }
  next();
});


// ================= STATIC METHODS =================

// Get all submissions for a draw
submissionSchema.statics.getByDraw = function (drawId) {
  return this.find({ drawId }).populate("userId", "name profilePicture");
};

// Get pending submissions
submissionSchema.statics.getPending = function () {
  return this.find({ status: "pending" })
    .populate("userId", "name profilePicture")
    .populate("drawId", "title");
};

export default mongoose.model("Submission", submissionSchema);
