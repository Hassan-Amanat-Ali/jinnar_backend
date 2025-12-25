// controllers/ChatController.js
import Message from "../models/Message.js";
import Order from "../models/Order.js"; // For creating the order
import Gig from "../models/Gig.js"; // For validation
import mongoose from "mongoose";

// Make sure this path matches where you put the notification code you showed me
import { sendNotification } from "./notificationController.js";

class ChatController {
  // 1. Send Message
  static async sendMessage(req, res) {
    try {
      const { receiverId, message } = req.body;
      const senderId = req.user.id;

      if (!receiverId)
        return res
          .status(400)
          .json({ success: false, message: "Receiver ID is required" });
      if (!message?.trim() && !req.file)
        return res.status(400).json({
          success: false,
          message: "Message or attachment is required",
        });

      let attachment = null;

      // Handle File Upload
      if (req.file) {
        // ✅ The upload middleware already processed the file
        attachment = {
          url: req.file.url,
          type: req.file.mimetype.startsWith("video") ? "video" : "image",
        };
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
          lastMessage:
            populatedMessage.message ||
            (attachment ? "Sent an attachment" : ""),
          lastTime: populatedMessage.createdAt,
          lastAttachment: attachment,
          unreadCount: 1, // Logic can be refined, but this triggers the "bold" text on frontend
        };

        // Send preview to receiver (so they see the new chat at the top)
        global.io.to(receiverId).emit("updateChatList", preview);

        // Send preview to sender (so their list updates too)
        global.io.to(senderId).emit("updateChatList", {
          ...preview,
          userId: receiverId,
          unreadCount: 0,
        });
      }

      // --- B. PUSH NOTIFICATION ---
      const notifContent = populatedMessage.message
        ? populatedMessage.message.length > 50
          ? populatedMessage.message.substring(0, 50) + "..."
          : populatedMessage.message
        : "Sent an attachment";

      await sendNotification(
        receiverId,
        "message", // Type
        `New message from ${populatedMessage.sender.name}: ${notifContent}`, // Content
        newMessage._id, // Related ID
        "Message" // Related Model
      );

      return res.json({
        success: true,
        message: "Message sent",
        data: populatedMessage,
      });
    } catch (error) {
      console.error("Chat send error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to send message" });
    }
  }

  // 1.5. Send Custom Offer in Chat (Seller's Action)
  static async sendCustomOffer(req, res) {
    try {
      const { id: sellerId, name: sellerName } = req.user;
      const {
        receiverId, // This is the buyerId
        gigId,
        price,
        jobDescription,
        date,
      } = req.body;

      // 1. Validation
      if (!receiverId || !gigId || !price || !jobDescription || !date) {
        return res.status(400).json({
          success: false,
          message:
            "receiverId, gigId, price, jobDescription, and date are required.",
        });
      }

      if (isNaN(price) || price <= 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Price must be a positive number.",
          });
      }

      // 2. Verify Gig
      const gig = await Gig.findById(gigId);
      if (!gig) {
        return res
          .status(404)
          .json({ success: false, message: "Gig not found." });
      }
      if (gig.sellerId.toString() !== sellerId) {
        return res
          .status(403)
          .json({
            success: false,
            message: "You can only create offers for your own gigs.",
          });
      }

      // 3. Create the Order document with 'offer_pending' status
      const newOrder = await Order.create({
        gigId,
        sellerId,
        buyerId: receiverId,
        price,
        jobDescription,
        date,
        status: "offer_pending",
        offerFrom: sellerId, // Mark as a seller-initiated offer
      });

      // 4. Create the special Message document
      const offerMessage = await Message.create({
        sender: sellerId,
        receiver: receiverId,
        message: `Custom Offer: ${jobDescription}`, // Fallback text
        customOffer: {
          orderId: newOrder._id,
          price: price,
          description: jobDescription,
          status: "pending",
        },
      });

      const populatedMessage = await Message.findById(offerMessage._id)
        .populate("sender", "name profilePicture")
        .populate("receiver", "name profilePicture");

      // 5. Emit Socket.IO event for real-time update
      if (global.io) {
        global.io.to(receiverId).emit("newMessage", populatedMessage);
        global.io.to(sellerId).emit("newMessage", populatedMessage);
      }

      // 6. Send Push Notification to the buyer
      await sendNotification(
        receiverId,
        "booking",
        `${sellerName} sent you a custom offer of ${price} for "${gig.title}".`,
        newOrder._id,
        "Order"
      );
      console.log(populatedMessage);

      return res.status(201).json({
        success: true,
        message: "Custom offer sent successfully.",
        data: populatedMessage,
      });
    } catch (error) {
      console.error("Send Custom Offer Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send custom offer.",
        details: error.message,
      });
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
      return res
        .status(500)
        .json({ success: false, message: "Failed to load messages" });
    }
  }

  // 3. Get Chat List
  static async getChatList(req, res) {
    try {
      const userId = new mongoose.Types.ObjectId(req.user.id);

      const chats = await Message.aggregate([
        {
          $match: {
            $or: [{ sender: userId }, { receiver: userId }],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
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
                      { $eq: ["$isRead", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            user: { _id: 1, name: 1, avatar: 1, profilePicture: 1 },
            lastMessage: 1,
            lastAttachment: 1,
            lastTime: 1,
            unreadCount: 1,
          },
        },
        { $sort: { lastTime: -1 } },
      ]);

      res.json({ success: true, chats });
    } catch (error) {
      console.error("Chat list error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to load chat list" });
    }
  }
}

export default ChatController;
