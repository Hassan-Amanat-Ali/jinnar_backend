import express from "express";
import { protect } from "../middleware/auth.js";
import WalletController from "../controllers/walletController.js";

const router = express.Router();

// Public (for frontend to show correct provider)
router.post("/predict", WalletController.predictCorrespondent);
router.get("/countries-providers", WalletController.getCountriesAndProviders);

// Protected routes
router.use(protect);
router.post("/deposit", WalletController.deposit);
router.post("/withdraw", WalletController.payout);
router.get("/balance", WalletController.getBalance);
router.get("/earnings", WalletController.getEarnings);

// Payout monitoring endpoints (protected)
router.get("/payout-status/:payoutId", WalletController.checkPayoutStatus);
router.get("/payout-stats", WalletController.getPayoutStats);

export default router;
