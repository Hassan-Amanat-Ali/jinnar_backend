// socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Message from "./models/Message.js";

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Allow all for testing
      methods: ["GET", "POST"],
    },
  });
global.io = io;
  // Fix: Store Set<SocketId> instead of single String
  // structure: Map<UserId, Set([socketId1, socketId2])>
  const onlineUsers = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id };
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    
    // 1. Add to Online Map (Multi-device logic)
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // 2. Join private room
    socket.join(userId);

    // 3. Broadcast Online Status (Only if this is their first connection)
    // If they are already online on another tab, don't spam "User Online"
    if (onlineUsers.get(userId).size === 1) {
      io.emit("userOnlineStatus", { userId, isOnline: true });
    }

    // 4. Send Current Online List to THIS user immediately
    const onlineUserIds = Array.from(onlineUsers.keys());
    socket.emit("getOnlineUsers", onlineUserIds);

    console.log(`User ${userId} connected. Active sockets: ${onlineUsers.get(userId).size}`);

    // --- MESSAGING ---
    socket.on("sendMessage", async (data, callback) => {
      const { receiverId, message, attachment } = data;
      const senderId = socket.user.id;

      try {
        // Validate: Must have message OR attachment
        if (!message?.trim() && !attachment) {
            throw new Error("Message or attachment required");
        }

        const newMessage = await Message.create({
          sender: senderId,
          receiver: receiverId,
          message: message?.trim(),
          attachment, // Expects { url, type } from client for this test
        });

        const populated = await Message.findById(newMessage._id)
          .populate("sender", "name avatar")
          .populate("receiver", "name avatar");

        // Send to Receiver
        io.to(receiverId).emit("newMessage", populated);
        
        // Send to Sender (to update their UI)
        io.to(senderId).emit("newMessage", populated);

        // Update Chat Lists
        updateChatListForBoth(senderId, receiverId, populated);

        // Acknowledge
        if (callback) callback({ status: "ok", data: populated });

      } catch (err) {
        console.error("Socket send error:", err);
        if (callback) callback({ status: "error", error: err.message });
      }
    });

    // --- TYPING ---
    socket.on("typing", ({ receiverId, isTyping }) => {
      io.to(receiverId).emit("userTyping", { senderId: userId, isTyping });
    });

    // --- DISCONNECT ---
    socket.on("disconnect", () => {
      const userSockets = onlineUsers.get(userId);
      
      if (userSockets) {
        userSockets.delete(socket.id); // Remove ONLY this socket connection

        // If user has 0 sockets left, they are truly offline
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("userOnlineStatus", { userId, isOnline: false });
          console.log(`User ${userId} went fully offline`);
        } else {
          console.log(`User ${userId} disconnected a tab (still online)`);
        }
      }
    });
  });

  const updateChatListForBoth = (user1, user2, latestMessage) => {
    const preview = {
      userId: user1 === latestMessage.sender._id.toString() ? latestMessage.receiver._id : latestMessage.sender._id,
      lastMessage: latestMessage.message || (latestMessage.attachment ? "Sent an attachment" : ""),
      lastTime: latestMessage.createdAt,
      lastAttachment: latestMessage.attachment,
    };
    io.to(user1).emit("updateChatList", preview);
    io.to(user2).emit("updateChatList", preview);
  };

  global.onlineUsers = onlineUsers;
};

export default setupSocket;