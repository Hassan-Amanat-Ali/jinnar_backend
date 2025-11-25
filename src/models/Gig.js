import mongoose from "mongoose";

const gigSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Seller ID is required"],
      index: true, // Added index for faster lookups
    },
    title: {
      type: String,
      required: [true, "Gig title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Gig description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    // --- NEW FIELDS FOR ADMIN MANAGEMENT ---
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "suspended"],
      default: "pending", // Default to pending so admins must approve them
      index: true, // Critical for the Admin "Get Pending Gigs" query
    },
    rejectionReason: {
      type: String,
      default: null, // Only populated if status is 'rejected' or 'suspended'
    },
    // ---------------------------------------
    images: {
      type: [{ url: String, publicId: String }],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 3;
        },
        message: "A gig can have a maximum of 3 images",
      },
    },
    pricing: {
      method: {
        type: String,
        enum: ["fixed", "hourly", "negotiable"],
        required: [true, "Pricing method is required"],
      },
      price: {
        type: Number,
        min: [0, "Price cannot be negative"],
        required: function () {
          return this.pricing?.method !== "negotiable";
        },
      },
    },
    //Replaced with Category reference
    skills: {
      type: [String],
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Category", // Links to the model above
      required: [false, "Please select a valid category"],
      index: true, // Crucial for Search Filters
    },
  },
  { timestamps: true },
);

export default mongoose.model("Gig", gigSchema);
