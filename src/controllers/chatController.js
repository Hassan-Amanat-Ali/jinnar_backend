// controllers/ChatController.js
import Message from "../models/Message.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import mongoose from "mongoose";


// Make sure this path matches where you put the notification code you showed me
import { sendNotification } from "./notificationController.js"; 

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class ChatController {
  
  // 1. Send Message
  static async sendMessage(req, res) {
    try {
      const { receiverId, message } = req.body;
      const senderId = req.user.id;

      if (!receiverId) return res.status(400).json({ success: false, message: "Receiver ID is required" });
      if (!message?.trim() && !req.file) return res.status(400).json({ success: false, message: "Message or attachment is required" });

      let attachment = null;

      // Handle File Upload
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "chat_attachments",
          resource_type: req.file.mimetype.startsWith("video") ? "video" : "image",
        });
        attachment = {
          url: result.secure_url,
          public_id: result.public_id,
          type: req.file.mimetype.startsWith("video") ? "video" : "image",
        };
        await fs.unlink(req.file.path).catch(() => {});
      }

      // Create in DB
      const newMessage = await Message.create({
        sender: senderId,
        receiver: receiverId,
        message: message?.trim() || "",
        attachment,
      });

      const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "name avatar profilePicture") // Added profilePicture just in case
        .populate("receiver", "name avatar profilePicture");

      // --- A. SOCKET.IO UPDATE ---
      if (global.io) {
        // Send message payload to both users
        global.io.to(receiverId).emit("newMessage", populatedMessage);
        global.io.to(senderId).emit("newMessage", populatedMessage);

        // Update chat list preview for both
        const preview = {
          userId: senderId,
          lastMessage: populatedMessage.message || (attachment ? "Sent an attachment" : ""),
          lastTime: populatedMessage.createdAt,
          lastAttachment: attachment,
          unreadCount: 1 // Logic can be refined, but this triggers the "bold" text on frontend
        };
        
        // Send preview to receiver (so they see the new chat at the top)
        global.io.to(receiverId).emit("updateChatList", preview);
        
        // Send preview to sender (so their list updates too)
        global.io.to(senderId).emit("updateChatList", { ...preview, userId: receiverId, unreadCount: 0 });
      }

      // --- B. PUSH NOTIFICATION ---
      const notifContent = populatedMessage.message 
        ? (populatedMessage.message.length > 50 ? populatedMessage.message.substring(0, 50) + '...' : populatedMessage.message)
        : 'Sent an attachment';

      await sendNotification(
        receiverId,
        'message', // Type
        `New message from ${populatedMessage.sender.name}: ${notifContent}`, // Content
        newMessage._id, // Related ID
        'Message' // Related Model
      );

      return res.json({
        success: true,
        message: "Message sent",
        data: populatedMessage,
      });

    } catch (error) {
      console.error("Chat send error:", error);
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(500).json({ success: false, message: "Failed to send message" });
    }
  }

  // 2. Get Conversation
  static async getConversation(req, res) {
    try {
      const { otherUserId } = req.params;
      const userId = req.user.id;

      const messages = await Message.find({
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      })
        .populate("sender", "name avatar profilePicture")
        .populate("receiver", "name avatar profilePicture")
        .sort({ createdAt: 1 });

      // Mark as read
      await Message.updateMany(
        { sender: otherUserId, receiver: userId, isRead: false },
        { isRead: true }
      );

      return res.json({ success: true, messages });
    } catch (error) {
      console.error("Get chat error:", error);
      return res.status(500).json({ success: false, message: "Failed to load messages" });
    }
  }

  // 3. Get Chat List
 static async getChatList(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const chats = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiver",
              "$sender"
            ],
          },
          lastMessage: { $first: "$message" },
          lastAttachment: { $first: "$attachment" },
          lastTime: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ["$receiver", userId] },
                    { $eq: ["$isRead", false] }
                  ] 
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          user: { _id: 1, name: 1, avatar: 1, profilePicture: 1 },
          lastMessage: 1,
          lastAttachment: 1,
          lastTime: 1,
          unreadCount: 1
        }
      },
      { $sort: { lastTime: -1 } }
    ]);

    res.json({ success: true, chats });

  } catch (error) {
    console.error("Chat list error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat list" });
  }
}

}

export default ChatController;