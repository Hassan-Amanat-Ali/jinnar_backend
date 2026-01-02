// router/notificationRoutes.js
import express from "express";
import {
  getNotifications,
  markAsRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";
import { sendTestNotification } from "../services/pushNotificationService.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.patch("/read", protect, markAsRead); // Legacy/Mark All
router.put("/:id/read", protect, markAsRead); // RESTful single mark read

// NEW: Test push notification
router.post("/test", protect, async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "FCM token is required" });
  }

  try {
    await sendTestNotification(token); // calls your Firebase Admin code
    res.json({ message: "Notification sent successfully" });
  } catch (err) {
    console.error("Error sending test notification:", err);
    res
      .status(500)
      .json({ message: "Failed to send notification", error: err.message });
  }
});

export default router;
