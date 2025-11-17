// controllers/walletController.js
import PawaPayService from "../services/pawapayService.js";
import {
  updateWalletBalance,
  deductWalletBalance,
  getWalletHistory,
  getOrCreateWallet,
} from "../services/walletService.js";
import logger from "../utils/logger.js";
import { validateDepositRequest, validatePayoutRequest } from "../utils/validators.js";
import crypto from "crypto";

const errorResponse = (res, message, status = 400) =>
  res.status(status).json({ status: "error", message });

// ──────────────────────────────────────────────────────────────
// TOP-UP WALLET VIA MOBILE MONEY (PawaPay Deposit)
// ──────────────────────────────────────────────────────────────
export const topupWallet = async (req, res) => {
  const { id: userId } = req.user;
  const { provider, amount, phoneNumber, country = "NG", currency = "NGN" } = req.body;

  // Generate unique orderId for this top-up
  const orderId = `TOPUP-${userId}-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;

  try {
    // Validate request
    const validationError = validateDepositRequest({
      provider,
      amount,
      phoneNumber,
      orderId,
      country,
      currency,
    });
    if (validationError) {
      return errorResponse(res, validationError, 400);
    }

    // Create deposit via PawaPay
    const depositResult = await PawaPayService.createDeposit({
      provider,
      amount,
      phoneNumber,
      orderId,
      country,
      currency,
    });

    // If deposit is immediately successful (rare), credit wallet right away
    if (depositResult.status === "SUCCESSFUL") {
      await updateWalletBalance(userId, amount, {
        type: "deposit",
        paymentMethod: "mobile_money",
        provider,
        pawaPayDepositId: depositResult.depositId,
        status: "successful",
      });
    }
    // Otherwise, status will be updated via webhook later

    logger.info(`Wallet top-up initiated | User: ${userId} | Order: ${orderId} | Amount: ${amount}`);

    res.status(201).json({
      message: "Top-up request sent to your phone",
      orderId,
      depositId: depositResult.depositId,
      status: depositResult.status,
      data: depositResult,
    });
  } catch (error) {
    logger.error(`Wallet top-up failed: ${error.message}`);
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Failed to initiate wallet top-up",
    });
  }
};

// ──────────────────────────────────────────────────────────────
// WITHDRAW WALLET TO MOBILE MONEY (PawaPay Payout)
// ──────────────────────────────────────────────────────────────
export const withdrawWallet = async (req, res) => {
  const { id: userId } = req.user;
  const { provider, amount, phoneNumber, country = "NG", currency = "NGN" } = req.body;

  const withdrawId = `WITHDRAW-${userId}-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;

  try {
    // Check wallet balance first
    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < amount) {
      return errorResponse(res, "Insufficient wallet balance", 400);
    }

    // Validate payout request
    const validationError = validatePayoutRequest({
      provider,
      amount,
      phoneNumber,
      withdrawId,
      country,
      currency,
    });
    if (validationError) {
      return errorResponse(res, validationError, 400);
    }

    // Deduct immediately (or you can wait for SUCCESS webhook)
    await deductWalletBalance(userId, amount, {
      type: "withdrawal",
      paymentMethod: "mobile_money",
      provider,
      pawaPayPayoutId: withdrawId,
      status: "pending",
    });

    // Initiate payout via PawaPay
    const payoutResult = await PawaPayService.createPayout({
      provider,
      amount,
      phoneNumber,
      withdrawId,
      country,
      currency,
    });

    logger.info(`Wallet withdrawal initiated | User: ${userId} | Amount: ${amount} | WithdrawID: ${withdrawId}`);

    res.status(201).json({
      message: "Withdrawal request sent",
      withdrawId,
      payoutId: payoutResult.payoutId,
      status: payoutResult.status,
      data: payoutResult,
    });
  } catch (error) {
    // If payout fails, you might want to reverse the deduction (optional)
    logger.error(`Wallet withdrawal failed: ${error.message}`);
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Failed to process withdrawal",
    });
  }
};

// ──────────────────────────────────────────────────────────────
// GET WALLET BALANCE & HISTORY
// ──────────────────────────────────────────────────────────────
export const getWallet = async (req, res) => {
  const { id: userId } = req.user;
  try {
    const wallet = await getWalletHistory(userId);
    res.json({
      status: "success",
      data: wallet,
    });
  } catch (err) {
    logger.error(`Get wallet failed: ${err.message}`);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// OPTIONAL: Check status of a top-up or withdrawal (useful for frontend polling)
// ──────────────────────────────────────────────────────────────
export const checkTransactionStatus = async (req, res) => {
  const { transactionId, type } = req.params; // type: "deposit" or "payout"

  try {
    if (!["deposit", "payout"].includes(type)) {
      return errorResponse(res, "Invalid transaction type", 400);
    }

    const result = await PawaPayService.checkTransactionStatus(transactionId, type);
    res.json({ status: "success", data: result });
  } catch (error) {
    logger.error(`Status check failed: ${error.message}`);
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Failed to check status",
    });
  }
};