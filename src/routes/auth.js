import express from "express";
import {
  registerUser,
  verifyCode,
  login,
  forgotPassword,
  resetPassword,
  resendVerificationCode,
  switchRole,
  initiateContactChange,
  verifyContactChange,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
// import { ussdHandler } from '../controllers/ussdController.js';
import { body, validationResult } from "express-validator";

const router = express.Router();

router.post("/register", registerUser);

router.post("/verify", verifyCode);
router.post("/resend-verification", resendVerificationCode);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/switch-role", protect, switchRole);

// Secure Contact Change Routes
router.post("/change-contact/initiate", protect, initiateContactChange);
router.post("/change-contact/verify", protect, verifyContactChange);

// router.post('/ussd', ussdHandler);

export default router;
