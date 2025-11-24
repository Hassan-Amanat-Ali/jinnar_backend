import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Question/Title is required"],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, "Answer/Content is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "General", 
        "Account", 
        "Payments", 
        "Orders", 
        "Safety", 
        "Technical", 
        "Verification", 
        "Pricing",
        "Hiring",
        "Registration",
        "Withdrawals",
        "Disputes"
      ],
      default: "General",
      index: true,
    },
    // --- ADD THIS FIELD ---
    tags: [{ type: String }], 
    // ----------------------
    targetAudience: {
      type: String,
      enum: ["all", "buyer", "seller"],
      default: "all",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

// Update the index to include tags
faqSchema.index({ question: "text", answer: "text", tags: "text" });

export default mongoose.model("FAQ", faqSchema);