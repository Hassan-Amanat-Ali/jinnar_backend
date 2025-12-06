import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: false, // <--- CHANGE 1: Set to false to allow Guest (null) senders
    },
    // Optional: Add this to distinguish between User/Guest/System in UI
    senderType: {
      type: String,
      enum: ['User', 'Guest', 'System'],
      default: 'User'
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
      default: () => uuidv4().split("-")[0].toUpperCase(),
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Ensure this is not required for guests
    },
    
    // <--- CHANGE 2: Add this section so Guest Info is actually saved to DB
    guestInfo: {
      name: { type: String },
      email: { type: String },
      phone: { type: String }
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
    assignmentHistory: [
      {
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: false,
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
      sentimentScore: { type: Number },
      priorityScore: { type: Number },
      confidenceScore: { type: Number },
      fraudFlag: { type: Boolean, default: false },
      suggestedTemplates: [{ type: String }], 
      templateJustification: { type: String },
      suggestedResponse: { type: String },
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
      ref: "User",
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SupportTicket", supportTicketSchema);