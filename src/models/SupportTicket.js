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
    },
    subject: {
      type: String,
      required: true,
    },
    conversation: [messageSchema],
    category: {
      type: String,
      enum: ['billing', 'technical', 'dispute', 'general', 'spam'],
      default: 'general',
    },
    internalNotes: [
      {
        agentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        note: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedCount: {
      type: Number,
      default: 0,
    },
    // Add inside supportTicketSchema
assignmentHistory: [
  {
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Make optional for system assignments
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
],

    aiAnalysis: {
      isAnalyzed: { type: Boolean, default: false },
      category: { 
        type: String, 
        enum: ['billing', 'technical', 'dispute', 'general', 'spam'],
        default: 'general'
      },
      sentimentScore: { type: Number }, // 1 (Angry) to 10 (Happy)
      priorityScore: { type: Number }, // 1 (Low) to 5 (Critical)
      confidenceScore: { type: Number }, // 0 to 1
      fraudFlag: { type: Boolean, default: false },
      suggestedResponse: { type: String }, // The draft for your admin
      analyzedAt: { type: Date }
    },
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
