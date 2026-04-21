import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import PawaPayController from "../services/pawapayService.js"; // your existing service
import logger from "../utils/logger.js";
import { validatePayoutRequest } from "../utils/validators.js";
import PawaPayService from "../services/pawapayService.js";
import PayoutMonitorService from "../services/payoutMonitorService.js";
import FXService from "../services/fxService.js";
import { BASE_CURRENCY } from "../config/fxRates.js";
import Decimal from "decimal.js";
import crypto from "crypto";

// Simple helper to get or create wallet
export const getUserWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({
      userId,
      balance: 0,
      currency: BASE_CURRENCY,
    });
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

  // 2. Deposit → Top-up Wallet (User adds money in LOCAL currency)
  //
  // Flow:
  //   1. Frontend sends: amount (local), currency (e.g. PKR), provider, phone, country
  //   2. Backend converts local → USD via FXService (rate locked now)
  //   3. PawaPay deposit created with ORIGINAL local amount
  //   4. Transaction stored with: amount=USD, localAmount=local, fxRate
  //   5. Wallet balance is NOT touched — callback handles that on COMPLETED
  //
  static async deposit(req, res) {
    const { phoneNumber, amount, provider, currency, country } = req.body;
    const userId = req.user.id; // from protect middleware

    if (!phoneNumber || !amount || !provider || !currency || !country) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }

    try {
      // Validate currency is supported
      if (!FXService.isSupported(currency)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported currency: ${currency}`,
        });
      }

      const localAmount = Number(amount);
      if (!localAmount || localAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a positive number",
        });
      }

      // ── FX Conversion: local → USD ────────────────────────────────
      // Rate is locked at this moment and stored in the transaction.
      // The callback will use the stored USD amount — never re-converts.
      const fx = await FXService.convertToUSD(localAmount, currency);

      const orderId = `DEP-${Date.now()}`;

      // Send ORIGINAL local amount to pawaPay (they operate in local currency)
      const pawaResult = await PawaPayController.createDeposit({
        phoneNumber,
        amount: localAmount,
        provider,
        orderId,
        country,
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

      // Create Transaction record (pending) — amount is in USD
      const tx = await Transaction.create({
        userId,
        type: "deposit",
        amount: fx.usdAmount,          // USD (base currency)
        localAmount: fx.localAmount,    // Original local amount
        fxRate: fx.rate,                // 1 USD = X local
        baseCurrency: BASE_CURRENCY,
        currency: currency,             // Original local currency code
        status: "pending",
        paymentMethod: provider,
        pawapayDepositId: depositId,
        correspondent: pawaResult.correspondent || null,
        country: country,
        metadata: pawaResult.metadata || null,
        description: `Deposit via ${provider}`,
        applied: false,
      });

      // Add pending transaction to wallet.transactions (embedded)
      // NO balance change — callback is the source of truth
      const wallet = await getUserWallet(userId);
      wallet.transactions.push({
        type: "deposit",
        amount: fx.usdAmount,           // USD
        localAmount: fx.localAmount,     // local
        fxRate: fx.rate,
        currency: currency,
        status: "pending",
        paymentMethod: provider,
        description: `Deposit via ${provider}`,
        createdAt: new Date(),
        pawapayDepositId: depositId,
        transactionId: tx._id,
      });
      await wallet.save();

      logger.info(
        `Deposit requested: User ${userId} localAmount=${localAmount} ${currency} → usdAmount=${fx.usdAmount} USD @ rate=${fx.rate} depositId=${depositId}`,
      );

      return res.json({
        success: true,
        message: "Deposit requested; awaiting confirmation",
        depositId,
        localAmount: fx.localAmount,
        currency: currency,
        usdAmount: fx.usdAmount,
        fxRate: fx.rate,
      });
    } catch (err) {
      logger.error("Deposit error:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Deposit failed",
          error: err.message,
        });
    }
  }

  // 3. Withdraw → Send money to phone (Payout)
  //
  // Flow:
  //   1. Frontend sends: amount (USD), currency (destination local), provider, phone, country
  //   2. Backend checks wallet.balance >= amount (both in USD)
  //   3. FXService converts USD → local currency (rate locked now)
  //   4. Funds RESERVED: balance -= USD, onHoldBalance += USD
  //   5. PawaPay payout created with CONVERTED local amount
  //   6. Callback finalizes: COMPLETED → release hold; FAILED → refund to balance
  //
  static async payout(req, res) {
    const { provider, amount, phoneNumber, country, currency } = req.body;
    const userId = req.user.id;

    const withdrawId = crypto.randomUUID();

    try {
      const validationError = validatePayoutRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      // Validate currency is supported
      if (!FXService.isSupported(currency)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported currency: ${currency}`,
        });
      }

      const usdAmount = Number(amount);
      if (!usdAmount || usdAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Amount must be a positive number",
        });
      }

      // Get wallet and check balance (both in USD)
      const wallet = await getUserWallet(userId);

      if (wallet.balance < usdAmount) {
        return res.status(400).json({
          success: false,
          error: "Insufficient balance for payout",
          currentBalance: wallet.balance,
          currency: BASE_CURRENCY,
          requestedAmount: usdAmount,
        });
      }

      // ── FX Conversion: USD → local ────────────────────────────────
      // Rate is locked at this moment and stored in the transaction.
      const fx = await FXService.convertFromUSD(usdAmount, currency);

      // ── Reserve funds (hold pattern) ──────────────────────────────
      // Move from available balance to onHoldBalance.
      // Callback will finalize: COMPLETED → release hold, FAILED → refund.
      wallet.balance = Number(
        new Decimal(wallet.balance).minus(usdAmount).toFixed(2),
      );
      wallet.onHoldBalance = Number(
        new Decimal(wallet.onHoldBalance || 0).plus(usdAmount).toFixed(2),
      );

      // Send CONVERTED local amount to pawaPay
      const result = await PawaPayService.createPayout({
        provider,
        amount: fx.localAmount, // local currency amount for pawaPay
        phoneNumber,
        withdrawId,
        country,
        currency,
      });

      // determine payout id from provider response, fallback to our withdrawId
      const payoutId = result?.data?.payoutId || result?.payoutId || withdrawId;

      // Create authoritative Transaction (pending) — amount is in USD
      const tx = await Transaction.create({
        userId,
        type: "withdrawal",
        amount: usdAmount,             // USD (base currency)
        localAmount: fx.localAmount,   // Converted local amount sent to pawaPay
        fxRate: fx.rate,               // 1 USD = X local
        baseCurrency: BASE_CURRENCY,
        currency: currency,            // Destination local currency
        status: "pending",
        paymentMethod: provider,
        pawapayPayoutId: payoutId,
        country: country,
        description: `Payout via ${provider}`,
        applied: false, // Will be marked true on callback COMPLETED
      });

      // Add pending nested wallet transaction
      wallet.transactions.push({
        type: "withdrawal",
        amount: usdAmount,             // USD
        localAmount: fx.localAmount,   // local
        fxRate: fx.rate,
        currency: currency,
        status: "pending",
        paymentMethod: provider,
        description: `Payout via ${provider}`,
        createdAt: new Date(),
        pawapayPayoutId: payoutId,
        transactionId: tx._id,
      });
      await wallet.save();

      logger.info(
        `Payout initiated: User ${userId} usdAmount=${usdAmount} USD → localAmount=${fx.localAmount} ${currency} @ rate=${fx.rate} payoutId=${payoutId} (funds on hold)`,
      );

      res
        .status(201)
        .json({
          success: true,
          message: "Payout initiated; awaiting confirmation",
          payoutId,
          usdAmount: usdAmount,
          localAmount: fx.localAmount,
          currency: currency,
          fxRate: fx.rate,
          newBalance: wallet.balance,
          onHoldBalance: wallet.onHoldBalance,
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
        currency: BASE_CURRENCY,
        onHoldBalance: wallet.onHoldBalance || 0,
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

  // Get earnings data for charts
  static async getEarnings(req, res) {
    const userId = req.user.id;

    try {
      const wallet = await getUserWallet(userId);

      // Get current month start and end dates
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Filter completed order_earned transactions for current month
      const earningTransactions = wallet.transactions.filter(tx => 
        tx.type === 'order_earned' && 
        tx.status === 'completed' &&
        tx.createdAt >= monthStart &&
        tx.createdAt <= monthEnd
      );

      // Calculate total monthly earnings (in USD)
      const monthlyEarnings = earningTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      // Group earnings by week
      const weeklyEarnings = [];
      const weeksInMonth = Math.ceil(monthEnd.getDate() / 7);

      for (let week = 0; week < weeksInMonth; week++) {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), week * 7 + 1);
        const weekEnd = new Date(now.getFullYear(), now.getMonth(), (week + 1) * 7, 23, 59, 59);

        const weekEarnings = earningTransactions
          .filter(tx => tx.createdAt >= weekStart && tx.createdAt <= weekEnd)
          .reduce((sum, tx) => sum + tx.amount, 0);

        weeklyEarnings.push({
          week: week + 1,
          amount: weekEarnings,
          startDate: weekStart,
          endDate: weekEnd > monthEnd ? monthEnd : weekEnd
        });
      }

      res.json({
        success: true,
        data: {
          monthlyEarnings,
          currency: BASE_CURRENCY,
          weeklyEarnings,
          totalTransactions: earningTransactions.length
        }
      });
    } catch (err) {
      logger.error("Error fetching earnings data", err);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err.message,
      });
    }
  }
}

export default WalletController;
