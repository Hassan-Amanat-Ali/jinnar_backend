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
      public_id: String,
      type: { type: String, enum: ["image", "video"] },
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ createdAt: -1 });

export default mongoose.model("Message", messageSchema);
