import express from "express";
import { protect } from "../middleware/auth.js";
import WalletController from "../controllers/walletController.js";


const router = express.Router();

// Public (for frontend to show correct provider)
router.post("/predict", WalletController.predictCorrespondent);

// Protected routes
router.use(protect);
router.post("/deposit", WalletController.deposit);
router.post("/withdraw", WalletController.payout);
router.get("/balance", WalletController.getBalance);

export default router;