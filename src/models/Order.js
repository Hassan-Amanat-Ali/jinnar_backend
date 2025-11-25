import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // Example: "2025-10-27"
      required: true,
    },
    timeSlot: {
      type: String, // e.g. "10:00 AM - 12:00 PM"
      required: false,
    },
    jobDescription: {
      type: String,
      required: true,
    },
    image: {
      type: String, // Optional single image (URL)
      default: null,
    },
    location: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
    },
    emergency: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "offer_pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    review: {
      type: String,
      default: null,
      max: 480,
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Order", orderSchema);
