import Conversation from '../models/Conversation.js';

export const startConversation = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { recipientId, gigId, content } = req.body;

    console.log('Start conversation request:', { recipientId, gigId, content });

    if (!recipientId || !content) {
      return res.status(400).json({ error: 'Recipient ID and content are required' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [id, recipientId] },
      gigId: gigId || null
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [id, recipientId],
        gigId: gigId || null,
        messages: [{ senderId: id, content }]
      });
    } else {
      conversation.messages.push({ senderId: id, content });
      conversation.lastMessageAt = Date.now();
    }

    await conversation.save();
    console.log('Conversation updated:', conversation._id);

    // Create notification for recipient
    const notification = new Notification({
      recipientId,
      type: 'message',
      content: `New message from ${req.user.name}`,
      relatedId: conversation._id,
      relatedModel: 'Conversation'
    });
    await notification.save();

    return res.status(200).json({ message: 'Message sent successfully', conversation });
  } catch (error) {
    console.error('Start Conversation Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};