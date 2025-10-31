import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gig',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be between 1 and 5'],
    max: [5, 'Rating must be between 1 and 5']
  },
  comment: {
    type: String,
    maxlength: [500, 'Review comment cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  profileImage: { 
  url: String, 
  publicId: String 
},
lastLogin: { 
  type: Date 
}
}, { timestamps: true });

reviewSchema.index({ sellerId: 1, createdAt: -1 });
reviewSchema.index({ buyerId: 1 });
reviewSchema.index({ orderId: 1 });

export default mongoose.model('Review', reviewSchema);