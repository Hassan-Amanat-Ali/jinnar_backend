import express from "express";
import PawaPayCallbackController from "../controllers/pawapayCallbackController.js";

const router = express.Router();

router.post("/callback/deposit", PawaPayCallbackController.depositCallback);
router.post("/callback/payout", PawaPayCallbackController.payoutCallback);
router.post("/callback/refund", PawaPayCallbackController.refundCallback);

export default router;
