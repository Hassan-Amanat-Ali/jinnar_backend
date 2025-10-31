// controllers/walletController.js
import Flutterwave from "flutterwave-node-v3";
import dotenv from "dotenv";
import {
  updateWalletBalance,
  deductWalletBalance,
  getWalletHistory,
  getOrCreateWallet
} from "../services/walletService.js";

dotenv.config();
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

const errorResponse = (res, message, field = null) =>
  res.status(400).json({ status: "error", message, ...(field && { field }) });

// ──────────────────────────────────────────────────────────────
// TOP-UP WALLET (CARD ONLY FOR NOW)
// ──────────────────────────────────────────────────────────────
export const topupWallet = async (req, res) => {
  const { id: userId } = req.user;
  const { email, amount, payment_method, phone_number, ...paymentData } = req.body;

  if (!amount || amount <= 0) return errorResponse(res, "Valid amount required", "amount");
  if (!payment_method) return errorResponse(res, "Payment method required", "payment_method");

  const tx_ref = `WALLET-${userId}-${Date.now()}`;
  const basePayload = {
    amount: String(amount),
    currency: "NGN",
    tx_ref,
    redirect_url: process.env.REDIRECT_URL || "http://localhost:3000/wallet/success",
    email: email || `${userId}@temp.com`,
    phone_number: phone_number || "08000000000",
    fullname: req.user.name,
    enckey: process.env.FLW_ENCRYPTION_KEY,
  };

  try {
    if (payment_method === "card") {
      const { card_number, cvv, expiry_month, expiry_year, pin } = paymentData;
      if (!card_number || !cvv || !expiry_month || !expiry_year)
        return errorResponse(res, "Card details required");

      let payload = { ...basePayload, card_number, cvv, expiry_month, expiry_year };
      if (pin) payload.pin = pin;

      let response = await flw.Charge.card(payload);

      if (response.meta?.authorization?.mode === "pin") {
        return res.json({
          status: "pin_required",
          flw_ref: response.data.flw_ref,
          message: "PIN required"
        });
      }

      if (response.meta?.authorization?.mode === "otp") {
        return res.json({
          status: "otp_required",
          flw_ref: response.data.flw_ref,
          message: "OTP sent"
        });
      }

      if (response.meta?.authorization?.mode === "redirect") {
        return res.json({
          status: "redirect",
          redirect_url: response.meta.authorization.redirect
        });
      }

      if (response.data.status === "successful") {
        await updateWalletBalance(userId, amount, {
          flutterwaveTxRef: tx_ref,
          flutterwaveFlwRef: response.data.flw_ref,
          paymentMethod: "card"
        });
        return res.json({ status: "success", message: "Wallet funded" });
      }
    }

    return errorResponse(res, "Method not supported yet");
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// VALIDATE OTP
// ──────────────────────────────────────────────────────────────
export const validateChargeOtp = async (req, res) => {
  const { flw_ref, otp } = req.body;
  const { id: userId } = req.user;

  if (!flw_ref || !otp) return errorResponse(res, "flw_ref and otp required");

  try {
    const result = await flw.Charge.validate({ flw_ref, otp });
    if (result.data.status === "successful") {
      await updateWalletBalance(userId, result.data.amount, {
        flutterwaveTxRef: result.data.tx_ref,
        flutterwaveFlwRef: result.data.flw_ref,
        paymentMethod: "card"
      });
      return res.json({ status: "success", message: "Funded via OTP" });
    }
    return res.status(400).json({ status: "failed", data: result.data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// WITHDRAW TO BANK
// ──────────────────────────────────────────────────────────────
export const withdrawWallet = async (req, res) => {
  const { id: userId } = req.user;
  const { amount, bank_code, account_number } = req.body;

  if (!amount || amount <= 0) return errorResponse(res, "Valid amount required");
  if (!bank_code || !account_number) return errorResponse(res, "Bank details required");

  try {
    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < amount) return errorResponse(res, "Insufficient balance");

    const reference = `WITHDRAW-${userId}-${Date.now()}`;
    const transfer = await flw.Transfer.initiate({
      account_bank: bank_code,
      account_number,
      amount,
      narration: "Wallet withdrawal",
      currency: "NGN",
      reference,
     callback_url: "https://google.com",
      debit_currency: "NGN"
    });

    if (transfer.status === "success") {
      await deductWalletBalance(userId, amount, {
        type: "withdrawal",
        paymentMethod: "bank_transfer",
        flutterwaveTxRef: reference,
        status: "pending"
      });
      return res.json({ message: "Withdrawal initiated", reference });
    }
console.log(transfer);
    return res.status(400).json({ error: "Transfer failed" + transfer.toString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET WALLET
// ──────────────────────────────────────────────────────────────
export const getWallet = async (req, res) => {
  const { id: userId } = req.user;
  try {
    const wallet = await getWalletHistory(userId);
    res.json(wallet);
  } catch (err) {
    res.status(500).json({  error: err.message });
  }
};