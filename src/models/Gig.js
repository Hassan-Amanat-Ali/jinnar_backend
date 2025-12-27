import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
  { _id: false },
); // Important: prevent _id in array items

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
    address: {
      type: String,
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"],
      default: null,
    },
    location: {
      type: pointSchema,
      default: null,
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
      type: [{ url: String }],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 3;
        },
        message: "A gig can have a maximum of 3 images",
      },
    },
    pricing: {
      fixed: {
        enabled: {
          type: Boolean,
          default: false,
        },
        price: {
          type: Number,
          min: [0, "Fixed price cannot be negative"],
        },
      },
      hourly: {
        enabled: {
          type: Boolean,
          default: false,
        },
        rate: {
          type: Number,
          min: [0, "Hourly rate cannot be negative"],
        },
        minHours: {
          type: Number,
          min: [0, "Minimum hours cannot be negative"],
        },
      },
      inspection: {
        enabled: {
          type: Boolean,
          default: true, // Inspection is always available by default
        },
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Category", // Links to the model above
      required: [true, "Please select a valid category"],
      index: true, // Crucial for Search Filters
    },
    primarySubcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: [true, "A primary subcategory is required"],
      index: true,
    },
    extraSubcategories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "SubCategory",
      default: [],
    },
  },
  { timestamps: true },
);

gigSchema.index({ location: "2dsphere" });

// Validation: At least one pricing option must be enabled
gigSchema.pre('save', function(next) {
  const hasAtLeastOneOption = 
    this.pricing.fixed.enabled || 
    this.pricing.hourly.enabled || 
    this.pricing.inspection.enabled;
  
  if (!hasAtLeastOneOption) {
    next(new Error('At least one pricing option must be enabled'));
  } else {
    // Validate that enabled options have required fields
    if (this.pricing.fixed.enabled && !this.pricing.fixed.price) {
      next(new Error('Fixed price is required when fixed pricing is enabled'));
    } else if (this.pricing.hourly.enabled && !this.pricing.hourly.rate) {
      next(new Error('Hourly rate is required when hourly pricing is enabled'));
    } else {
      next();
    }
  }
});

export default mongoose.model("Gig", gigSchema);
