// models/Message.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, trim: true },
    attachment: {
      url: String,
      type: { type: String, enum: ["image", "video"] },
    },
    isRead: { type: Boolean, default: false },
    customOffer: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      price: Number,
      description: String,
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "cancelled"],
      },
    },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ createdAt: -1 });

export default mongoose.model("Message", messageSchema);
