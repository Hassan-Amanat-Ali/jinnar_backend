// routes/chat.js
import express from "express";
import ChatController from "../controllers/ChatController.js";
import { protect } from "../middleware/auth.js";
import { uploadChatAttachmentMW } from "../middleware/upload.js"; // your file

const router = express.Router();

router.use(protect);

// Routes
router.post("/send", uploadChatAttachmentMW, ChatController.sendMessage);
router.get("/with/:otherUserId", ChatController.getConversation);
router.get("/list", ChatController.getChatList);

export default router;