import express from "express";
import { protect } from "../middleware/auth.js";
import { uploadChatAttachmentMW } from "../middleware/upload.js"; // Use the correct single attachment uploader
import ChatController from "../controllers/chatController.js";

const router = express.Router();

router.use(protect);

// Routes
router.post("/send", ...uploadChatAttachmentMW, ChatController.sendMessage);
router.post("/custom-offer", ChatController.sendCustomOffer);
router.get("/with/:otherUserId", ChatController.getConversation);
router.get("/list", ChatController.getChatList);

export default router;
