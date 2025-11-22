import express from "express";
import { paymentController } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
const router = express.Router();

router.get("/providers", paymentController.getProviders);
router.post("/predict-correspondent", paymentController.predictCorrespondent);
router.post("/deposit", protect, paymentController.deposit);
router.post("/payout", protect, paymentController.payout);
router.get("/status/:transactionId/:type", paymentController.checkStatus);
router.post("/refund", paymentController.refund);

export default router;
