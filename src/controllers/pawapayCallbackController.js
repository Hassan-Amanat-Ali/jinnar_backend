import logger from "../utils/logger.js";

class PawaPayCallbackController {

  // 🔹 Deposit callback
  static depositCallback = async (req, res) => {
    try {
      console.log("📥 Deposit Callback Received:", req.body);

    //   const {
    //     depositId,
    //     status,
    //     rejectionReason,
    //     metadata,
    //     amount,
    //     currency
    //   } = req.body;

      logger.info("Deposit Callback", req.body);

      // Example: update order/payment record in DB
      // await Payment.updateOne({ depositId }, { status });

      res.status(200).json({ message: "Deposit callback processed" });

    } catch (error) {
      console.error("Deposit callback error:", error);
      return res.status(500).json({ error: "Callback failed" });
    }
  };

  // 🔹 Payout callback
  static payoutCallback = async (req, res) => {
    try {
      console.log("📥 Payout Callback Received:", req.body);

      const {
        payoutId,
        status,
        rejectionReason,
        amount,
        currency,
        metadata
      } = req.body;

      logger.info("Payout Callback", req.body);

      // Example DB update
      // await Withdrawal.updateOne({ payoutId }, { status });

      res.status(200).json({ message: "Payout callback processed" });

    } catch (error) {
      console.error("Payout callback error:", error);
      res.status(500).json({ error: "Callback failed" });
    }
  };

  // 🔹 Refund callback
  static refundCallback = async (req, res) => {
    try {
      console.log("📥 Refund Callback Received:", req.body);

      const {
        refundId,
        status,
        rejectionReason,
        depositId,
        amount,
        currency
      } = req.body;

      logger.info("Refund Callback", req.body);

      // Example DB update
      // await Refund.updateOne({ refundId }, { status });

      res.status(200).json({ message: "Refund callback processed" });

    } catch (error) {
      console.error("Refund callback error:", error);
      res.status(500).json({ error: "Callback failed" });
    }
  };
}

export default PawaPayCallbackController;
