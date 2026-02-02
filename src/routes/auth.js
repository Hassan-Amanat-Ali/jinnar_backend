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
import passport from "passport";
import "../config/passport.js"; // Ensure config is loaded

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

// Native Social Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Import controller dynamically or assume it's imported at top
    // Since we imported named exports from authController, we need to add socialAuthCallback to imports above
    // Or just inline the logic here or cleaner: call the controller.
    // Let's rely on the controller method we added.
    import("../controllers/authController.js").then(mod => mod.socialAuthCallback(req, res));
  }
);

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    import("../controllers/authController.js").then(mod => mod.socialAuthCallback(req, res));
  }
);

// Facebook (JWT via redirect – token persisted on User for Viral post verification)
router.get('/facebook', passport.authenticate('facebook', { scope: ['email', 'user_posts'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    import("../controllers/authController.js").then(mod => mod.socialAuthCallback(req, res));
  }
);

export default router;
