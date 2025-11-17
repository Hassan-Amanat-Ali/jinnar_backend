import Wallet from "../models/Wallet.js";
import PawaPayController from "../services/pawapayService.js"; // your existing service
import logger from "../utils/logger.js";

// Simple helper to get or create wallet
const getUserWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0 });
  }
  return wallet;
};

class WalletController {
  // 1. Predict Mobile Money Provider (e.g., JazzCash, Easypaisa)
  static async predictCorrespondent(req, res) {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number required" });
    }

    try {
      const result = await PawaPayController.predictCorrespondent(phoneNumber);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error });
      }

      res.json({
        success: true,
        provider: result.data.correspondent,
        country: result.data.country,
        currency: result.data.currency,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" , err });
    }
  }

  // 2. Deposit → Top-up Wallet (User adds money)
  static async deposit(req, res) {
    const { phoneNumber, amount, provider, currency , country } = req.body;
    const userId = req.user.id; // from protect middleware

    if (!phoneNumber || !amount || !provider || !currency || !country) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    try {
      const orderId = `DEP-${Date.now()}`;

      const pawaResult = await PawaPayController.createDeposit({
        phoneNumber,
        amount: Number(amount),
        provider,
        orderId,
        country, // Pakistan
        currency,
      });

      if (!pawaResult.success) {
        return res.status(400).json({
          success: false,
          message: "Payment request failed",
          error: pawaResult.error,
        });
      }

      const depositId = pawaResult.depositId;

      // Instantly add to wallet (for testing — later move to webhook)
      const wallet = await getUserWallet(userId);
      wallet.balance += Number(amount);
      wallet.transactions.push({
        type: "deposit",
        amount: Number(amount),
        status: "completed", // fake success for testing
        paymentMethod: provider,
        description: `Deposit via ${provider}`,
        createdAt: new Date(),
      });
      await wallet.save();

      logger.info(`TEST DEPOSIT SUCCESS: User ${userId} +${amount} PKR`);

      return res.json({
        success: true,
        message: "Deposit successful! (Test mode: money added instantly)",
        balance: wallet.balance,
        depositId,
      });
    } catch (err) {
      logger.error("Deposit error:", err);
      res.status(500).json({ success: false, message: "Deposit failed" });
    }
  }

  // 3. Withdraw → Send money to phone
  static async withdraw(req, res) {
    const { phoneNumber, amount, provider , currency , country } = req.body;
    const userId = req.user.id;

    if (!phoneNumber || !amount || !provider || !currency || !country) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    if (amount < 100) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal: 100 PKR" });
    }

    try {
      const wallet = await getUserWallet(userId);

      if (wallet.balance < amount) {
        return res.status(400).json({ success: false, message: "Insufficient balance" });
      }

      const withdrawId = `WDR-${Date.now()}`;

      const pawaResult = await PawaPayController.createPayout({
        phoneNumber,
        amount: Number(amount),
        provider,
        withdrawId,
        country,
        currency,
      });

      if (!pawaResult.success) {
        return res.status(400).json({
          success: false,
          message: "Withdrawal failed",
          error: pawaResult.error,
        });
      }

      const payoutId = pawaResult.payoutId;

      // Deduct immediately (for testing)
      wallet.balance -= Number(amount);
      wallet.transactions.push({
        type: "withdrawal",
        amount: Number(amount),
        status: "completed", // fake success
        paymentMethod: provider,
        description: `Withdraw to ${phoneNumber}`,
        createdAt: new Date(),
      });
      await wallet.save();

      logger.info(`TEST WITHDRAWAL SUCCESS: User ${userId} -${amount} PKR`);

      return res.json({
        success: true,
        message: "Withdrawal successful! (Test mode)",
        balance: wallet.balance,
        payoutId,
      });
    } catch (err) {
      logger.error("Withdraw error:", err);
      res.status(500).json({ success: false, message: "Withdrawal failed" });
    }
  }

  // 4. Get Wallet Balance
  static async getBalance(req, res) {
    const userId = req.user.id;

    try {
      const wallet = await getUserWallet(userId);
      const recentTransactions = wallet.transactions.slice(-10).reverse();

      res.json({
        success: true,
        balance: wallet.balance,
        transactions: recentTransactions,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error : " , err });
    }
  }
}

export default WalletController;