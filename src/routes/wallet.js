// src/routes/walletRoutes.js (CORRECTED VERSION)

import express from "express";
import {
  topupWallet,
  withdrawWallet,
  getWallet,
} from "../controllers/walletController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Core wallet routes
router.post("/topup", topupWallet);
router.post("/withdraw", withdrawWallet);
router.get("/", getWallet);

// Fixed route — escape parentheses with backslashes
// router.get(
//   "/status/:type(deposit\\|payout)/:transactionId",
//   checkTransactionStatus
// );

// Alternative (cleaner and recommended): Use a regex with .get() directly
// router.get("/status/:type/:transactionId", checkTransactionStatus)
//   .where({ type: /^(deposit|payout)$/ });

export default router;