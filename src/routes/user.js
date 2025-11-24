import express from "express";
import {
  getPublicProfile,
  updateUser,
  getMyProfile,
  updateFcmToken,
  getSellerReviews,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { createReport, getMyReports } from "../controllers/ReportController.js";

const router = express.Router();

// Update user route with support for user and gig file uploads
router.post("/update", protect, updateUser);
router.get("/profile", protect, getMyProfile);
router.get("/public/:id", getPublicProfile);
router.get("/public/:id/reviews", getSellerReviews);
router.post("/fcm-token", protect, updateFcmToken);
router.post("/reports/create", protect, createReport);
router.get("/reports/me", protect, getMyReports);

export default router;
