import express from "express";
import pawapayCallbackRoutes from "./pawapayCallback.js";

import authRoutes from "./auth.js";
import gigRoutes from "./gig.js";
import userRoutes from "./user.js";
import imagesRoutes from "./image.js";
import paymentRoutes from "./payment.js";
import payoutRoutes from "./payout.js";
import notificationRoutes from "./notification.js";
import orderRoutes from "./order.js";
import walletRoutes from "./wallet.js";
import uploadRoutes from "./uploadRoutes.js";
import workerRoutes from "./workers.js";
import chatRoutes from "./chat.js";
import { getSkills } from "../controllers/gigController.js";
import faqRoutes from "./faq.js";
import adminRoutes from "./admin.js"; 
import chatbotRoutes from "./chatbot.js";
import supportRoutes from "./support.js";
import recommendationRoutes from "./recommendation.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/gigs", gigRoutes);
router.use("/user", userRoutes);
router.use("/images", imagesRoutes);
router.use("/payment", paymentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/orders", orderRoutes);
router.use("/wallet", walletRoutes);
router.use("/upload", uploadRoutes);
// router.use('/payout' , payoutRoutes)
router.use("/workers", workerRoutes);
router.use("/checkout", chatRoutes);
router.use("/pawapay", pawapayCallbackRoutes);
router.use("/chat", chatRoutes);
router.use("/chatbot",chatbotRoutes );
router.use("/support", supportRoutes);
router.use("/r", recommendationRoutes);

router.use("/admin", adminRoutes); 

router.use("/categories", getSkills);
router.use("/faq" , faqRoutes)

export default router;
