import express from "express";
import PawaPayCallbackController from "../controllers/pawapayCallbackController.js";
// IP allowlist middleware for callbacks
import ipAllowlist from "../middleware/ipAllowlist.js";
const router = express.Router();

router.post(
  "/callback/deposit",
  express.raw({ type: "application/json" }),
  ipAllowlist(),
  PawaPayCallbackController.depositCallback,
);
router.post(
  "/callback/payout",
  express.raw({ type: "application/json" }),
  ipAllowlist(),
  PawaPayCallbackController.payoutCallback,
);
router.post(
  "/callback/refund",
  express.raw({ type: "application/json" }),
  ipAllowlist(),
  PawaPayCallbackController.refundCallback,
);

export default router;
