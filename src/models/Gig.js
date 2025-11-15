import mongoose from 'mongoose';

const gigSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Gig title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Gig description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    images: {
      type: [{ url: String, publicId: String }],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 3;
        },
        message: 'A gig can have a maximum of 3 images',
      },
    },
    pricing: {
      method: {
        type: String,
        enum: ['fixed', 'hourly', 'negotiable'],
        required: [true, 'Pricing method is required'],
      },
      price: {
        type: Number,
        min: [0, 'Price cannot be negative'],
        required: function () {
          return this.method !== 'negotiable';
        },
      },
    },
     skills: {
      type: [String], // added skills array
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model('Gig', gigSchema);