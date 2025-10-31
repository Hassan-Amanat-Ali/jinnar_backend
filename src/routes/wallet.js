// src/routes/walletRoutes.js
import express from "express";
import { topupWallet , validateChargeOtp,withdrawWallet,getWallet} from "../controllers/walletController.js";
import { protect } from "../middleware/auth.js";
const router = express.Router();

router.post("/topup",protect, topupWallet);   // /api/wallet/topup
router.post("/validateCharge-otp",protect,validateChargeOtp)
router.post("/withdraw", protect, withdrawWallet);
router.get("/", protect, getWallet);

// router.get("/verify",protect, verifyPayment);   
  // /api/wallet/verify?transaction_id=123&userId=abc

export default router;
