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
);

const userSchema = new mongoose.Schema(
  {
    // --- AUTH FIELDS (Flexible Email OR Mobile) ---
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Invalid email address"],
      // Sparse allows multiple documents to have 'null' for this field,
      // but if a value exists, it must be unique.
      unique: true,
      sparse: true,
      default: undefined,
    },
    mobileNumber: {
      type: String,
      trim: true,
      match: [
        /^\+[1-9]\d{1,14}$/,
        "Mobile number must be in E.164 format (e.g., +1234567890)",
      ],
      unique: true,
      sparse: true,
      default: undefined,
    },
    password: {
      type: String,
      required: false,
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },

    // --- NEW: FOR SECURE CONTACT SWITCHING ---
    tempContact: {
      type: { type: String, enum: ["email", "mobileNumber"] },
      value: String,
      code: String,
      expires: Date,
    },

    // --- STANDARD PROFILE FIELDS ---
    name: {
      type: String,
      required: false, // Required only for sellers (enforced in controller)
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    role: {
      type: String,
      enum: [
        "buyer",
        "seller",
        "support",
        "supervisor",
        "regional_manager",
        "super_admin",
      ],
      required: true,
      default: "buyer",
    },
    country: {
  type: String,
  trim: true,
  default: null,
},

city: {
  type: String,
  trim: true,
  default: null,
},

socialAccounts: {
  tiktok: {
    username: { type: String, default: null },
    accessToken: { type: String, default: null, select: false }, // hide by default
    connected: { type: Boolean, default: false },
  },
  facebook: {
    username: { type: String, default: null },
    accessToken: { type: String, default: null, select: false },
    connected: { type: Boolean, default: false },
  },
  instagram: {
    username: { type: String, default: null },
    accessToken: { type: String, default: null, select: false },
    connected: { type: Boolean, default: false },
  },
},

totalPoints: {
  type: Number,
  default: 0,
  min: 0,
},

    profilePicture: {
      type: String,
      default: null,
    },
    fcmTokens: [
      {
        token: { type: String, required: true },
        deviceInfo: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      inAppNotifications: { type: Boolean, default: true },
      twoFactorAuth: { type: Boolean, default: false },
      language: { type: String, default: "en" }, // ISO 639-1 codes
    },
    lastLogin: {
      type: Date,
      default: null,
    },

    // --- VERIFICATION & STATUS ---
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["unsubmitted", "pending", "approved", "rejected"],
      default: "unsubmitted",
    },
    verificationCode: {
      type: String,
      default: null,
    },
    verificationCodeExpires: {
      type: Date,
      default: null,
    },
    identityDocuments: [
      {
        documentType: {
          type: String,
          required: true,
          enum: ["passport", "national_id", "drivers_license", "other"],
        },
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionDetails: {
      reason: String,
      suspendedAt: Date,
      suspendedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      relatedReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Report",
      },
      internalNote: String,
    },
    suspensionHistory: [
      {
        reason: String,
        suspendedAt: Date,
        suspendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reinstatedAt: Date,
        reinstatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        relatedReport: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Report",
        },
        internalNote: String,
      },
    ],

    // --- SELLER SPECIFIC FIELDS ---
    bio: {
      type: String,
      maxlength: 500,
    },
    skills: [{ type: String, trim: true }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    subcategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    ],
    languages: [{ type: String, trim: true }],
    yearsOfExperience: { type: Number, min: 0 },
    selectedAreas: [pointSchema],
    preferredAreas: [pointSchema],

    // --- TRANSACTIONS & ACTIVITY ---
    wallet: {
      balance: { type: Number, default: 0 },
      transactions: [], // Define transaction schema if needed
    },
    notifications: [
      {
        type: {
          type: String,
          enum: ["order", "message", "wallet", "system"],
          required: true,
        },
        content: { type: String, required: true },
        relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
        isRead: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],

    // --- RATINGS ---
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    lastRecommendedAt: { type: Date, default: null },
    averageResponseTime: { type: Number, default: null },
    reviews: [
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 0, max: 5 },
        review: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // --- MEDIA ---
    portfolioImages: [{ url: String }],
    videos: [{ url: String }],
    certificates: [{ url: String }],

    // --- AVAILABILITY ---
    availability: {
      type: [
        new mongoose.Schema(
          {
            day: {
              type: String,
              enum: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ],
              required: true,
            },
            timeSlots: [
              {
                type: String,
                enum: ["morning", "afternoon", "evening"],
                required: true,
              },
            ],
            // Optional detailed slot start/end (HH:mm)
            start: { type: String, default: undefined },
            end: { type: String, default: undefined },
            // Optional breaks/unavailable ranges inside the main slot
            breaks: [
              {
                start: { type: String, required: true },
                end: { type: String, required: true },
              },
            ],
          },
          { _id: false },
        ),
      ],
      default: [],
      validate: {
        validator: function (v) {
          if (!v) return true;
          const days = v.map((slot) => slot.day);
          return new Set(days).size === days.length;
        },
        message: "Duplicate days in availability",
      },
    },
  },
  { timestamps: true },
);

// Indexes
userSchema.index({ "wallet.transactions.createdAt": -1 });
userSchema.index({ "wallet.transactions.paymentMethod": 1 });
userSchema.index({ "availability.day": 1 });
userSchema.index({ selectedAreas: "2dsphere" });
userSchema.index({ location: "2dsphere" });
userSchema.index({ "notifications.createdAt": -1 });
userSchema.index({ "socialAccounts.tiktok.connected": 1 });
userSchema.index({ "socialAccounts.facebook.connected": 1 });
userSchema.index({ "socialAccounts.instagram.connected": 1 });
userSchema.index({ totalPoints: -1 }); 


// Ensure at least one auth method is present before saving
userSchema.pre("save", function (next) {
  if (!this.email && !this.mobileNumber) {
    return next(new Error("Either email or mobile number is required"));
  }
  next();
});

// Hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const bcrypt = await import("bcryptjs");
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = await import("bcryptjs");
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
