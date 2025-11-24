import express from "express";
import { publicChat, createGuestTicket , debugBot } from "../controllers/ChatbotController.js";
const router = express.Router();


router.post("/chat", publicChat);
router.post("/chat/ticket", createGuestTicket);
router.get("/debug", debugBot)
export default router;