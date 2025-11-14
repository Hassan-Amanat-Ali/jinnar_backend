import express from "express";
import crypto from "crypto";
import logger from "../utils/logger.js";

const router = express.Router();

// Verify webhook signature
function verifySignature(req) {
  const signatureHeader = req.headers["x-pawapay-signature"];
  if (!signatureHeader) return false;

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", process.env.PAWAPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === signatureHeader;
}

router.post("/pawapay/callback", express.json(), async (req, res) => {
  try {
    const isValid = verifySignature(req);
    if (!isValid) {
      logger.warn("Invalid PawaPay signature", { body: req.body });
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { depositId, payoutId, status, metadata, rejectionReason } = req.body;

    logger.info("Received PawaPay callback", {
      depositId,
      payoutId,
      status,
      metadata,
    });

    // ✅ Handle logic based on status
    if (status === "SUCCESSFUL") {
      // e.g., mark order as paid in your database
      logger.info("Payment successful", { depositId, payoutId });
      // await OrderModel.updateOne({ orderId: metadata.orderId }, { paymentStatus: "PAID" });
    } else if (status === "FAILED" || status === "REJECTED") {
      logger.warn("Payment failed/rejected", { rejectionReason });
      // await OrderModel.updateOne({ orderId: metadata.orderId }, { paymentStatus: "FAILED" });
    }

    // Respond quickly (PawaPay expects 2xx)
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error("Error processing PawaPay callback", { error: err.message });
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
