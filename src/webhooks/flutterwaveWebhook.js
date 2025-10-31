// routes/webhook.js
import express from "express";
import { updateWalletBalance } from "../services/walletService.js";
import User from "../models/User.js";

const router = express.Router();

// routes/webhook.js
router.post("/flutterwave", express.raw({ type: "application/json" }), async (req, res) => {
  const hash = req.headers["verif-hash"];
  if (hash !== process.env.FLW_WEBHOOK_SECRET) return res.status(401).send();

  const payload = req.body;

  // TOP-UP
  if (payload.event === "charge.completed" && payload.data.status === "successful") {
    const { tx_ref, amount, flw_ref } = payload.data;
    if (tx_ref.startsWith("WALLET-")) {
      const userId = tx_ref.split("-")[1];
      await updateWalletBalance(userId, amount, {
        flutterwaveTxRef: tx_ref,
        flutterwaveFlwRef: flw_ref,
        paymentMethod: "card"
      });
    }
  }

  // WITHDRAWAL
  if (payload.event === "transfer.completed" && payload.data.status === "SUCCESSFUL") {
    const { reference } = payload.data;
    const wallet = await Wallet.findOne({ "transactions.flutterwaveTxRef": reference });
    if (wallet) {
      const tx = wallet.transactions.find(t => t.flutterwaveTxRef === reference);
      if (tx) tx.status = "completed";
      await wallet.save();
    }
  }

  res.sendStatus(200);
});
export default router;