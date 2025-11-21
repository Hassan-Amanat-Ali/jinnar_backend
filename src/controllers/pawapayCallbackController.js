import mongoose from "mongoose";
import logger from "../utils/logger.js";
import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";

const logRequest = (label, body) => {
  const info = {
    time: new Date().toISOString(),
    label,
    body: body || {},
  };
  logger.info(label, info);
  console.log(`----- ${label} -----`);
  console.log(JSON.stringify(info, null, 2));
  console.log(`----- END ${label} -----`);
};

class PawaPayCallbackController {

  static depositCallback = async (req, res) => {
    logRequest('Deposit Callback Received', req.body);
    const { depositId, status, depositedAmount, requestedAmount, correspondent, correspondentIds, country, currency, metadata } = req.body;

    if (!depositId) {
      return res.status(400).json({ message: "Deposit ID is missing." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transaction = await Transaction.findOne({ pawapayDepositId: depositId }).session(session);

      if (!transaction) {
        logger.error(`Deposit callback: Transaction not found for depositId: ${depositId}`);
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Transaction not found." });
      }

      if (transaction.status === 'completed') {
        logger.warn(`Deposit callback: Transaction ${transaction._id} already completed.`);
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ message: "Transaction already processed." });
      }

      const wallet = await Wallet.findOne({ userId: transaction.userId }).session(session);
      if (!wallet) {
        logger.error(`Deposit callback: Wallet not found for userId: ${transaction.userId}`);
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Wallet not found." });
      }

      const embeddedTx = wallet.transactions.find(t => t.pawapayDepositId === depositId);

      if (status === 'COMPLETED') {
        transaction.status = 'completed';
        // update amount if provided by provider
        const amt = depositedAmount || requestedAmount || transaction.amount;
        transaction.amount = Number(amt) || transaction.amount;
        transaction.correspondent = correspondent || transaction.correspondent;
        transaction.correspondentIds = correspondentIds || transaction.correspondentIds;
        transaction.country = country || transaction.country;
        transaction.currency = currency || transaction.currency;
        transaction.metadata = metadata || transaction.metadata;

        if (embeddedTx) embeddedTx.status = 'completed';
        // credit wallet by transaction.amount
        wallet.balance += Number(transaction.amount || 0);
      } else if (status === 'FAILED') {
        transaction.status = 'failed';
        if (embeddedTx) embeddedTx.status = 'failed';
        // Balance was not added, so no need to deduct anything
      } else {
        // For other statuses like 'PENDING', 'ACCEPTED', we just log and don't change our state
        logger.info(`Deposit callback: Received status '${status}' for depositId ${depositId}. No action taken.`);
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ message: "Callback received, no final status yet." });
      }
      
      await transaction.save({ session });
      await wallet.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Deposit callback processed successfully." });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Deposit callback error:", error);
      res.status(500).json({ error: "Internal server error during deposit callback." });
    }
  };

  static payoutCallback = async (req, res) => {
    logRequest('Payout Callback Received', req.body);
    const { payoutId, status, amount, correspondent, correspondentIds, country, currency, metadata } = req.body;

    if (!payoutId) {
      return res.status(400).json({ message: "Payout ID is missing." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transaction = await Transaction.findOne({ pawapayPayoutId: payoutId }).session(session);

      if (!transaction) {
        logger.error(`Payout callback: Transaction not found for payoutId: ${payoutId}`);
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Transaction not found." });
      }
      
      if (transaction.status === 'completed' || transaction.status === 'failed') {
        logger.warn(`Payout callback: Transaction ${transaction._id} already finalized.`);
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ message: "Transaction already processed." });
      }

      const wallet = await Wallet.findOne({ userId: transaction.userId }).session(session);
      if (!wallet) {
        logger.error(`Payout callback: Wallet not found for userId: ${transaction.userId}`);
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Wallet not found." });
      }
      
      const embeddedTx = wallet.transactions.find(t => t.pawapayPayoutId === payoutId);

      if (status === 'COMPLETED') {
        transaction.status = 'completed';
        transaction.correspondent = correspondent || transaction.correspondent;
        transaction.correspondentIds = correspondentIds || transaction.correspondentIds;
        transaction.country = country || transaction.country;
        transaction.currency = currency || transaction.currency;
        transaction.metadata = metadata || transaction.metadata;
        if (embeddedTx) embeddedTx.status = 'completed';
        // Balance was already deducted at payout request time; nothing further needed
      } else if (status === 'FAILED') {
        transaction.status = 'failed';
        if (embeddedTx) embeddedTx.status = 'failed';
        // Refund the optimistically deducted amount (use transaction.amount or amount from payload)
        const amt = Number(transaction.amount || amount || 0);
        wallet.balance += amt;
      } else {
        logger.info(`Payout callback: Received status '${status}' for payoutId ${payoutId}. No action taken.`);
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ message: "Callback received, no final status yet." });
      }

      await transaction.save({ session });
      await wallet.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Payout callback processed successfully." });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Payout callback error:", error);
      res.status(500).json({ error: "Internal server error during payout callback." });
    }
  };

  static refundCallback = async (req, res) => {
    logRequest('Refund Callback Received', req.body);
    // Implementation for refund callback can be added here if needed
    res.status(200).json({ message: "Refund callback received." });
  };
}

export default PawaPayCallbackController;