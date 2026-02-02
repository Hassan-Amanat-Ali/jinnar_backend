import express from "express";
import pawapayCallbackRoutes from "./pawapayCallback.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "../config/swagger.js";
import { serveFile } from "../controllers/fileController.js"; // ✅ Import the new file server

import authRoutes from "./auth.js";
import userRoutes from "./user.js";
import payoutRoutes from "./payout.js";
import notificationRoutes from "./notification.js";
import orderRoutes from "./order.js";
import walletRoutes from "./wallet.js";
import uploadRoutes from "./uploadRoutes.js";
import workerRoutes from "./workers.js";
import chatRoutes from "./chat.js";
import faqRoutes from "./faq.js";
import adminRoutes from "./admin.js";
import chatbotRoutes from "./chatbot.js";
import supportRoutes from "./support.js";
import recommendationRoutes from "./recommendation.js";
import categoryRoutes from "./category.js";
import paymentRoutes from "./payment.js";
import gigRoutes from "./gig.js";
import imageRoutes from "./image.js"; // Import the refactored legacy image route
import systemConfigRoutes from "./systemConfig.js";
import enrollmentRoutes from "./enrollmentRoutes.js";
import viralRoutes from "./viral.js";
// import { checkMaintenanceMode } from "../middleware/maintenance.js";

const router = express.Router();

// ✅ Apply Maintenance Mode Check Globally
// router.use(checkMaintenanceMode);

// ✅ Swagger Documentation Route
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ✅ Add the new file serving route and protect it
router.get("/files/:folder/:filename", serveFile);

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/notifications", notificationRoutes);
router.use("/orders", orderRoutes);
router.use("/wallet", walletRoutes);
router.use("/upload", uploadRoutes);
// router.use('/payout' , payoutRoutes)
router.use("/workers", workerRoutes);
// router.use("/checkout", chatRoutes);
router.use("/pawapay", pawapayCallbackRoutes);
router.use("/chat", chatRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/r", recommendationRoutes);
router.use("/support", supportRoutes);
router.use("/admin", adminRoutes);
router.use("/payment", paymentRoutes);
router.use("/config", systemConfigRoutes);

router.use("/gigs", gigRoutes);
router.use("/categories", categoryRoutes);
router.use("/faq", faqRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/viral", viralRoutes);

// Legacy route for backward compatibility
router.use("/images", imageRoutes);

export default router;
