import express from "express";
import {
  getPublicProfile,
  updateUser,
  getMyProfile,
  updateFcmToken,
  getSellerReviews,
  submitForVerification,
  getUserDetailsForAdmin,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/auth.js";
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

// --- NEW: Identity Verification ---
router.post("/submit-verification", protect, submitForVerification);

// --- NEW: Admin route to get full user details ---
router.get("/details/:id", protect, authorize("super_admin"),getUserDetailsForAdmin);

export default router;
