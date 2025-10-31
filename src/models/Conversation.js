import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  ],
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gig',
    default: null
  },
  messages: [messageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure unique conversations between participants
conversationSchema.index({ participants: 1, gigId: 1 }, { unique: true });

export default mongoose.model('Conversation', conversationSchema);