import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import PawaPayController from "../services/pawapayService.js"; // your existing service
import logger from "../utils/logger.js";
import { validatePayoutRequest } from "../utils/validators.js";
import PawaPayService from "../services/pawapayService.js";
import PayoutMonitorService from "../services/payoutMonitorService.js";
import crypto from "crypto";

// Simple helper to get or create wallet
export const getUserWallet = async (userId) => {
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
      return res
        .status(400)
        .json({ success: false, message: "Phone number required" });
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
      res.status(500).json({ success: false, message: "Server error", err });
    }
  }

  // 2. Deposit → Top-up Wallet (User adds money)
  static async deposit(req, res) {
    const { phoneNumber, amount, provider, currency, country } = req.body;
    const userId = req.user.id; // from protect middleware


    


    if (!phoneNumber || !amount || !provider || !currency || !country) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
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

      // Create Transaction record (pending)
      const tx = await Transaction.create({
        userId,
        type: "deposit",
        amount: Number(amount),
        status: "pending",
        paymentMethod: provider,
        pawapayDepositId: depositId,
        correspondent: pawaResult.correspondent || null,
        country: country,
        currency: currency,
        metadata: pawaResult.metadata || null,
        description: `Deposit via ${provider}`,
      });

      // Add pending transaction to wallet.transactions (nested)
      const wallet = await getUserWallet(userId);
      wallet.transactions.push({
        type: "deposit",
        amount: Number(amount),
        status: "pending",
        paymentMethod: provider,
        description: `Deposit via ${provider}`,
        createdAt: new Date(),
        pawapayDepositId: depositId,
        transactionId: tx._id,
      });
      await wallet.save();

      logger.info(
        `Deposit requested: User ${userId} amount=${amount} depositId=${depositId}`,
      );

      return res.json({
        success: true,
        message: "Deposit requested; awaiting confirmation",
        depositId,
      });
    } catch (err) {
      logger.error("Deposit errora:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Deposit failed",
          error: err.message,
        });
    }
  }

  // 3. Withdraw → Send money to phone
  static async payout(req, res) {
    const { provider, amount, phoneNumber, country, currency } = req.body;
    const userId = req.user.id;

    const withdrawId = crypto.randomUUID();

    try {
      const validationError = validatePayoutRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      // Get wallet and check balance
      const wallet = await getUserWallet(userId);
      const numAmount = Number(amount);

      if (wallet.balance < numAmount) {
        return res.status(400).json({
          success: false,
          error: "Insufficient balance for payout",
          currentBalance: wallet.balance,
          requestedAmount: numAmount,
        });
      }

      // initiate payout with provider
      const result = await PawaPayService.createPayout({
        provider,
        amount,
        phoneNumber,
        withdrawId,
        country,
        currency,
      });

      // determine payout id from provider response, fallback to our withdrawId
      const payoutId = result?.data?.payoutId || result?.payoutId || withdrawId;

      // create authoritative Transaction (pending)
      const tx = await Transaction.create({
        userId,
        type: "withdrawal",
        amount: numAmount,
        status: "pending",
        paymentMethod: provider,
        pawapayPayoutId: payoutId,
        country: country,
        currency: currency,
        description: `Payout via ${provider}`,
        applied: false, // Will be marked as applied when confirmed
      });

      // Deduct balance immediately when payout is initiated
      wallet.balance -= numAmount;

      // Add pending nested wallet transaction
      wallet.transactions.push({
        type: "withdrawal",
        amount: numAmount,
        status: "pending",
        paymentMethod: provider,
        description: `Payout via ${provider}`,
        createdAt: new Date(),
        pawapayPayoutId: payoutId,
        transactionId: tx._id,
      });
      await wallet.save();

      logger.info(
        `Payout initiated: User ${userId} amount=${numAmount} payoutId=${payoutId}`,
      );

      res
        .status(201)
        .json({
          success: true,
          message: "Payout initiated; awaiting confirmation",
          payoutId,
          newBalance: wallet.balance,
          providerResult: result,
        });
    } catch (error) {
      logger.error(`Payout failed: ${error?.message || error}`);
      res
        .status(error?.statusCode || 500)
        .json({ error: error?.message || "An unexpected error occurred" });
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
      res.status(500).json({ success: false, message: "Server error : ", err });
    }
  }

  // Get available countries and their providers
  static async getCountriesAndProviders(req, res) {
    const { operationType = "DEPOSIT" } = req.query;

    try {
      // Validate operationType
      if (!["DEPOSIT", "PAYOUT"].includes(operationType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid operationType. Must be 'DEPOSIT' or 'PAYOUT'",
        });
      }

      const result = await PawaPayService.getActiveConfiguration(operationType);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Format the response - map countries and providers correctly
      const formattedData = {
        success: true,
        companyName: result.data.companyName,
        operationType,
        countries: result.data.countries.map((country) => ({
          countryCode: country.country,
          countryName: country.displayName.en,
          countryNameFr: country.displayName.fr,
          prefix: country.prefix,
          flag: country.flag,
          providers: country.providers.map((provider) => ({
            providerId: provider.provider,
            displayName: provider.displayName,
            logo: provider.logo,
            nameDisplayedToCustomer: provider.nameDisplayedToCustomer || "",
            currencies: provider.currencies.map((currency) => ({
              code: currency.currency,
              displayName: currency.displayName,
              operationDetails: currency.operationTypes[operationType] || null,
            })),
          })),
        })),
      };

      res.json(formattedData);
    } catch (err) {
      logger.error("Failed to fetch countries and providers", err);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }

  // Check status of a specific payout immediately
  static async checkPayoutStatus(req, res) {
    const { payoutId } = req.params;

    if (!payoutId) {
      return res.status(400).json({
        success: false,
        message: "Payout ID is required",
      });
    }

    try {
      const result = await PayoutMonitorService.checkSpecificPayout(payoutId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (err) {
      logger.error(`Error checking payout status for ${payoutId}`, err);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }

  // Get payout statistics
  static async getPayoutStats(req, res) {
    try {
      const result = await PayoutMonitorService.getPayoutStats();

      if (!result.success) {
        return res.status(500).json(result);
      }

      res.json(result);
    } catch (err) {
      logger.error("Error fetching payout stats", err);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }
}

export default WalletController;
