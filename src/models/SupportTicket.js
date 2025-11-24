import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Can be a User or Admin
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    attachments: [
      {
        url: { type: String, required: true },
        fileName: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      default: () => uuidv4().split("-")[0].toUpperCase(), // Example: 5E8D9A
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    conversation: [messageSchema],
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Should be an Admin user
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Should be an Admin user
      default: null,
    },
  },
  { timestamps: true }
);

// For guest tickets, we'll use a simpler schema or handle it differently
// This revised model is primarily for authenticated users.

export default mongoose.model("SupportTicket", supportTicketSchema);