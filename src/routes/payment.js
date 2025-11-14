import express from "express";
import { paymentController } from "../controllers/paymentController.js";

const router = express.Router();

router.get("/providers", paymentController.getProviders);
router.post("/predict-correspondent", paymentController.predictCorrespondent);
router.post("/deposit", paymentController.deposit);
router.post("/payout", paymentController.payout);
router.get("/status/:transactionId/:type", paymentController.checkStatus);
router.post("/refund", paymentController.refund);

export default router;