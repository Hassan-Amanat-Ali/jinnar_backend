import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Add this near top-level fields in your userSchema:
fcmTokens: [
  {
    token: { type: String, required: true },
    deviceInfo: { type: String, default: null }, // optional - phone model, etc.
    createdAt: { type: Date, default: Date.now },
  },
],
profilePicture: {
  type: String, default: null
},

  name: { 
    type: String, 
    required: false, 
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },

  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    trim: true,
    match: [/^\+[1-9]\d{1,14}$/, 'Mobile number must be in E.164 format (e.g., +1234567890)']
  },
  role: { 
    type: String, 
    enum: ['seller', 'buyer'], 
    required: true 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  verificationCode: {
    type: String,
    default: null
  },
  verificationCodeExpires: {
    type: Date,
    default: null
  },
  bio: { 
    type: String, 
    maxlength: 500 
  },
  skills: [{ 
    type: String,
    trim: true
  }],
  languages: [{ 
    type: String,
    trim: true
  }],
  yearsOfExperience: { 
    type: Number, 
    min: 0 
  },
  selectedAreas: [{ // For sellers: areas where they offer services
    lat: { 
      type: Number, 
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90
    },
    lng: { 
      type: Number, 
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180
    }
  }],
  preferredAreas: [{ // For buyers: preferred areas for finding gigs
    lat: { 
      type: Number, 
      min: -90,
      max: 90
    },
    lng: { 
      type: Number, 
      min: -180,
      max: 180
    }
  }],
// Add to your existing User schema

notifications: [
  {
    type: {
      type: String,
      enum: ['order', 'message', 'wallet', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
],


  orderHistory: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order' 
  }],
  rating: { // Average rating for sellers, calculated from reviews
    average: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 5 
    },
    count: { 
      type: Number, 
      default: 0, 
      min: 0 
    }
  },
  portfolioImages: [{ 
    url: String, 
    publicId: String 
  }],
  videos: [{ 
    url: String, 
    publicId: String 
  }],
  certificates: [{ 
    url: String, 
    publicId: String 
  }],
  availability: {
    type: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
      },
      timeSlots: [{
        type: String,
        enum: ['morning', 'afternoon', 'evening'],
        required: true
      }]
    }],
    default: [],
    validate: {
      validator: function (v) {
        const days = v.map(slot => slot.day);
        return new Set(days).size === days.length;
      },
      message: 'Duplicate days in availability'
    }
  }
}, { timestamps: true });

userSchema.index({ mobileNumber: 1 });
userSchema.index({ 'wallet.transactions.createdAt': -1 });
userSchema.index({ 'wallet.transactions.paymentMethod': 1 });
userSchema.index({ 'availability.day': 1 });

userSchema.index({ 'notifications.createdAt': -1 }); 
// For efficient notification retrieval

export default mongoose.model('User', userSchema);