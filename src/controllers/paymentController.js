import PawaPayService from "../services/pawapayService.js";
import { getSupportedProviders } from "../services/correspondentService.js";
import { validateDepositRequest, validatePayoutRequest, validateRefundRequest } from "../utils/validators.js";
import logger from "../utils/logger.js";

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
        const {msisdn} = req.body ;
console.log("this is req body " , req.body)
    const response = await PawaPayService.predictCorrespondent(msisdn);

    res.status(200).json(response);
    
    } catch (error) {
        console.log("Predicting Correspondent Failed:"  , error.message);
        res.status(500).json({ error: "Failed to predict correspondent" });
    }

},


  // POST /api/payments/deposit
  async deposit(req, res) {
    const { provider, amount, phoneNumber, country, currency } = req.body;

    const orderId =  () => {
  const ts = Date.now().toString(36);  
  const rnd = Math.random().toString(36).substring(2, 8);
  return `ORD-${ts}-${rnd}`.toUpperCase();
};


    try {
      const validationError = validateDepositRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const result = await PawaPayService.createDeposit({
        provider,
        amount,
        phoneNumber,
        orderId,
        country,
        currency,
      });

      logger.info(`Deposit processed successfully for order: ${orderId}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error(`Deposit failed: ${error.message}`);
      res.status(error.statusCode || 500).json({
        error: error.message || "An unexpected error occurred",
      });
    }
  },

  // POST /api/payments/payout
  async payout(req, res) {
    const { provider, amount, phoneNumber,  country, currency } = req.body;
const withdrawId = crypto.randomUUID();
    try {
      const validationError = validatePayoutRequest(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const result = await PawaPayService.createPayout({
        provider,
        amount,
        phoneNumber,
        withdrawId,
        country,
        currency,
      });

      logger.info(`Payout processed successfully for withdrawId: ${withdrawId}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error(`Payout failed: ${error.message}`);
      res.status(error.statusCode || 500).json({
        error: error.message || "An unexpected error occurred",
      });
    }
  },

  // GET /api/payments/status/:transactionId/:type
  async checkStatus(req, res) {
    const { transactionId, type } = req.params;

    try {
      if (!["deposit", "payout"].includes(type)) {
        return res.status(400).json({ error: "Invalid transaction type" });
      }

      const result = await PawaPayService.checkTransactionStatus(transactionId, type);

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

      const result = await PawaPayService.createRefund(depositId, amount, reason);

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

