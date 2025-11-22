import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true,
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [lng, lat]
    required: true
  }
}, { _id: false }); // Important: prevent _id in array items


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
  email:{
    type : String,unique: true , lowercase : true, trime : true,
    match: [/\S+@\S+\.\S+/, 'Invalid email address']
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
    enum: ['buyer', 'seller', 'support', 'supervisor', 'regional_manager', 'super_admin'],
    required: true,
    default: 'buyer'
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  // NEW: Detailed verification status
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // NEW: To hold URLs of uploaded ID documents
  identityDocuments: [{
    url: String,
    publicId: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  // NEW: For suspending users
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionDetails: {
    reason: String,
    suspendedAt: Date
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
  selectedAreas: [pointSchema],   // seller-specific
  preferredAreas: [pointSchema],  // buyer-specificto your existing User schema

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
  // Stores individual reviews left by buyers for this user (seller)
  reviews: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: { type: Number, min: 0, max: 5 },
      review: { type: String, default: null },
      createdAt: { type: Date, default: Date.now }
    }
  ],
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
userSchema.index({ 'selectedAreas': '2dsphere' });
// userSchema.index({ 'preferredAreas': '2dsphere' });
userSchema.index({ 'notifications.createdAt': -1 }); 
// For efficient notification retrieval

export default mongoose.model('User', userSchema);