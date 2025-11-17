// routes/wallet.js
import express from "express";
import WalletController from "../controllers/WalletController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public (for frontend to show correct provider)
router.post("/predict", WalletController.predictCorrespondent);

// Protected routes
router.use(protect);
router.post("/deposit", WalletController.deposit);
router.post("/withdraw", WalletController.withdraw);
router.get("/balance", WalletController.getBalance);

export default router;