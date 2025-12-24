import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Message from "./models/Message.js";

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  global.io = io;

  const onlineUsers = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.warn("[Socket] Authentication error: No token provided");
      return next(new Error("Authentication error"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id };
      console.log(`[Socket] Authenticated user: ${decoded.id}`);
      next();
    } catch {
      console.warn("[Socket] Invalid token");
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    console.log(`[Socket] User connected: ${userId}, socketId: ${socket.id}`);

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    socket.join(userId);

    if (onlineUsers.get(userId).size === 1) {
      io.emit("userOnlineStatus", { userId, isOnline: true });
    }

    socket.emit("getOnlineUsers", Array.from(onlineUsers.keys()));

    socket.on("sendMessage", async (data, callback) => {
      const { receiverId, message, attachment } = data;
      const senderId = userId;
      console.log(
        `[Socket] sendMessage from ${senderId} to ${receiverId}: ${
          message ? message : "[attachment]"
        }`
      );
      try {
        if (!message?.trim() && !attachment) {
          throw new Error("Message or attachment required");
        }

        const newMessage = await Message.create({
          sender: senderId,
          receiver: receiverId,
          message: message?.trim(),
          attachment,
        });

        const populated = await Message.findById(newMessage._id)
          .populate("sender", "name avatar")
          .populate("receiver", "name avatar");

        io.to(receiverId).emit("newMessage", populated);
        io.to(senderId).emit("newMessage", populated);

        updateChatListForBoth(senderId, receiverId, populated);

        callback?.({ status: "ok", data: populated });
      } catch (err) {
        console.error(`[Socket] sendMessage error: ${err.message}`);
        callback?.({ status: "error", error: err.message });
      }
    });

    socket.on("typing", ({ receiverId, isTyping }) => {
      io.to(receiverId).emit("userTyping", {
        senderId: userId,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      const userSockets = onlineUsers.get(userId);

      if (!userSockets) return;

      userSockets.delete(socket.id);

      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("userOnlineStatus", { userId, isOnline: false });
        console.log(`[Socket] User disconnected: ${userId}`);
      } else {
        console.log(
          `[Socket] Socket disconnected: ${socket.id} for user: ${userId}`
        );
      }
    });
  });

  const updateChatListForBoth = (user1, user2, latestMessage) => {
    const preview = {
      userId:
        user1 === latestMessage.sender._id.toString()
          ? latestMessage.receiver._id
          : latestMessage.sender._id,
      lastMessage:
        latestMessage.message ||
        (latestMessage.attachment ? "Sent an attachment" : ""),
      lastTime: latestMessage.createdAt,
      lastAttachment: latestMessage.attachment,
    };

    io.to(user1).emit("updateChatList", preview);
    io.to(user2).emit("updateChatList", preview);
  };

  global.onlineUsers = onlineUsers;
};

export default setupSocket;
