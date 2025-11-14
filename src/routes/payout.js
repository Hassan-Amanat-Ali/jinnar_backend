import express from "express";
import { paymentController } from "../controllers/payoutController.js";

const router = express.Router();

router.get("/providers", paymentController.getProviders);
router.post("/", paymentController.payout);

export default router;
