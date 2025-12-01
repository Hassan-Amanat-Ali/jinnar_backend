import express from "express";
import {
  registerUser,
  verifyCode,
  login,
  forgotPassword,
  resetPassword,
  resendVerificationCode,
  switchRole,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
// import { ussdHandler } from '../controllers/ussdController.js';
import { body, validationResult } from "express-validator";

const router = express.Router();

router.post(
  "/register",
  [
    body("email")
      .isEmail()
      .withMessage("Invalid email address")
      .normalizeEmail(),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  registerUser,
);

router.post("/verify", verifyCode);
router.post("/resend-verification", resendVerificationCode);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/switch-role", protect, switchRole);

// router.post('/ussd', ussdHandler);

export default router;
