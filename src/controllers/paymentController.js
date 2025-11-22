import PawaPayService from "../services/pawapayService.js";
import { getSupportedProviders } from "../services/correspondentService.js";
import {
  validatePayoutRequest,
  validateRefundRequest,
} from "../utils/validators.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import Transaction from "../models/Transaction.js";

// Simple helper to get or create wallet
import { getUserWallet } from "./walletController.js";
import PawaPayController from "../services/pawapayService.js";

export const paymentController = {
  // GET /api/payments/providers
  getProviders(req, res) {
    try {
      const { deposit } = getSupportedProviders();
      res.status(200).json(deposit);
    } catch (error) {
      logger.error(`Failed to fetch providers: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  },

  // POST /api/payment/predict-correspondent
  async predictCorrespondent(req, res) {
    try {
      const { msisdn } = req.body;
      console.log("this is req body ", req.body);
      const response = await PawaPayService.predictCorrespondent(msisdn);

      res.status(200).json(response);
    } catch (error) {
      console.log("Predicting Correspondent Failed:", error.message);
      res.status(500).json({ error: "Failed to predict correspondent" });
    }
  },

  // POST /api/payments/deposit
  // POST /api/payments/deposit
  // 2. Deposit → Top-up Wallet (User adds money)

  async deposit(req, res) {
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
      logger.error("Deposit errorrrr:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Deposit failed",
          error: err.message,
        });
    }
  },

  // 3. Withdraw → Send money to phone
  async payout(req, res) {
    const { provider, amount, phoneNumber, country, currency } = req.body;
    const userId = req.user.id;

    const withdrawId = crypto.randomUUID();

    try {
      const validationError = validatePayoutRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
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
        amount: Number(amount),
        status: "pending",
        paymentMethod: provider,
        pawapayPayoutId: payoutId,
        country: country,
        currency: currency,
        description: `Payout via ${provider}`,
      });

      // add pending nested wallet transaction (do NOT deduct balance yet)
      const wallet = await getUserWallet(userId);
      wallet.transactions.push({
        type: "withdrawal",
        amount: Number(amount),
        status: "pending",
        paymentMethod: provider,
        description: `Payout via ${provider}`,
        createdAt: new Date(),
        pawapayPayoutId: payoutId,
        transactionId: tx._id,
      });
      await wallet.save();

      res
        .status(201)
        .json({
          success: true,
          message: "Payout initiated; awaiting confirmation",
          payoutId,
          providerResult: result,
        });
    } catch (error) {
      logger.error(`Payout failed: ${error?.message || error}`);
      res
        .status(error?.statusCode || 500)
        .json({ error: error?.message || "An unexpected error occurred" });
    }
  },
  // GET /api/payments/status/:transactionId/:type
  async checkStatus(req, res) {
    const { transactionId, type } = req.params;

    try {
      if (!["deposit", "payout"].includes(type)) {
        return res.status(400).json({ error: "Invalid transaction type" });
      }

      const result = await PawaPayService.checkTransactionStatus(
        transactionId,
        type,
      );

      logger.info(`Status checked for transaction: ${transactionId}`);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Status check failed: ${error.message}`);
      res.status(error.statusCode || 500).json({
        error: error.message || "An unexpected error occurred",
      });
    }
  },

  // POST /api/payments/refund
  async refund(req, res) {
    const { depositId, amount, reason } = req.body;

    try {
      const validationError = validateRefundRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const result = await PawaPayService.createRefund(
        depositId,
        amount,
        reason,
      );

      logger.info(`Refund processed successfully for deposit: ${depositId}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error(`Refund failed: ${error.message}`);
      res.status(error.statusCode || 500).json({
        error: error.message || "An unexpected error occurred",
      });
    }
  },
};
