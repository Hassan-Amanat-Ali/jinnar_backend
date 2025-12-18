import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";
import PawaPayService from "./pawapayService.js";
import logger from "../utils/logger.js";

/**
 * Payout Monitor Service
 * Listens to all pending payouts in the database and regularly checks their status
 * through PawaPay, updating transaction and wallet balances accordingly.
 * 
 * This service runs continuously and updates:
 * 1. Transaction status in Transaction collection
 * 2. Wallet transaction status in Wallet collection
 * 3. User wallet balance (deduct on completion, refund on failure)
 */
class PayoutMonitorService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Check all pending payouts and update their status
   * This method is called by Agenda scheduler every minute
   */
  async checkPendingPayouts() {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n🔍 [PAYOUT MONITOR - ${timestamp}] Starting payout status check...`);
      logger.info("Starting payout status check...");

      // Find all pending payout transactions
      const pendingPayouts = await Transaction.find({
        type: "withdrawal",
        status: "pending",
        pawapayPayoutId: { $exists: true, $ne: null },
      }).populate("userId", "name email mobileNumber");

      if (pendingPayouts.length === 0) {
        console.log(`✓ [PAYOUT MONITOR] No pending payouts to check`);
        logger.info("No pending payouts to check");
        return;
      }

      console.log(
        `📦 [PAYOUT MONITOR] Found ${pendingPayouts.length} pending payouts to check`
      );
      logger.info(`Found ${pendingPayouts.length} pending payouts to check`);

      // Check status for each payout
      let updated = 0;
      let skipped = 0;

      for (const payout of pendingPayouts) {
        try {
          // Skip if userId is null (deleted user or invalid reference)
          if (!payout.userId) {
            console.log(
              `⚠️  [PAYOUT MONITOR] Skipping payout ${payout.pawapayPayoutId} - user reference is null`
            );
            logger.warn(
              `Skipping payout ${payout.pawapayPayoutId} - user reference is null`
            );
            skipped++;
            continue;
          }
          await this.updatePayoutStatus(payout);
          updated++;
        } catch (error) {
          console.error(
            `❌ [PAYOUT MONITOR] Error checking payout ${payout.pawapayPayoutId}: ${error.message}`
          );
          logger.error(
            `Error checking payout ${payout.pawapayPayoutId}: ${error.message}`
          );
          // Continue with next payout even if one fails
        }
      }

      console.log(
        `✅ [PAYOUT MONITOR] Payout status check completed - Updated: ${updated}, Skipped: ${skipped}`
      );
      logger.info("Payout status check completed");
    } catch (error) {
      console.error(`❌ [PAYOUT MONITOR] Error in checkPendingPayouts: ${error.message}`);
      logger.error(`Error in checkPendingPayouts: ${error.message}`, error);
    }
  }

  /**
   * Update a single payout's status by querying PawaPay
   * Updates both transaction and wallet records with the latest status
   * @param {Object} transaction - Transaction document from DB
   */
  async updatePayoutStatus(transaction) {
    const payoutId = transaction.pawapayPayoutId;
    // Handle both populated object and direct ID
    const userId = transaction.userId?._id || transaction.userId;

    try {
      console.log(`  → Checking payout: ${payoutId}`);
      logger.info(`Checking payout status for ${payoutId}`);

      // Fetch payout status from PawaPay
      const pawapayResult = await PawaPayService.getPayoutStatus(payoutId);

      if (!pawapayResult.success) {
        console.log(`  ❌ Failed to fetch payout status: ${pawapayResult.error}`);
        logger.warn(
          `Failed to fetch payout status from PawaPay for ${payoutId}: ${pawapayResult.error}`,
        );
        return;
      }

      const payoutData = pawapayResult.data;
      const pawapayStatus = payoutData.status;

      console.log(`  📡 PawaPay status: ${pawapayStatus}`);
      logger.info(
        `Payout ${payoutId} status from PawaPay: ${pawapayStatus}`,
      );

      // Map PawaPay status to our internal status
      const internalStatus = this.mapPayoutStatus(pawapayStatus);

      // Check if status changed
      if (internalStatus === transaction.status) {
        console.log(`  ℹ️  Status unchanged (${internalStatus})`);
        logger.debug(
          `Payout ${payoutId} status unchanged (${internalStatus})`,
        );
        return;
      }

      console.log(
        `  🔄 Status changed: ${transaction.status} → ${internalStatus}`
      );
      logger.info(
        `Payout ${payoutId} status changed from ${transaction.status} to ${internalStatus}`,
      );

      // Update transaction status with full payout data
      transaction.status = internalStatus;
      transaction.metadata = payoutData;
      transaction.providerTransactionId = payoutData.providerTransactionId || null;
      await transaction.save();

      console.log(`  💾 Updated Transaction record: status=${internalStatus}`);
      logger.info(
        `Updated Transaction record for payout ${payoutId}: status=${internalStatus}`,
      );

      // Update wallet transaction status and apply balance changes
      if (userId) {
        const wallet = await Wallet.findOne({ userId });

        if (wallet) {
          // Find and update the wallet transaction
          const walletTx = wallet.transactions.find(
            (tx) =>
              tx.pawapayPayoutId === payoutId ||
              tx.transactionId?.toString() === transaction._id.toString(),
          );

          if (walletTx) {
            walletTx.status = internalStatus;
            console.log(`  💳 Updated Wallet transaction: status=${internalStatus}`);
            logger.info(
              `Updated Wallet transaction record for payout ${payoutId}: status=${internalStatus}`,
            );
          }

          // Apply balance effects (refund if failed, etc.)
          await this.applyPayoutEffect(transaction, internalStatus, wallet);

          // Save wallet after balance changes
          await wallet.save();
          console.log(`  ✅ Wallet saved: balance=${wallet.balance}`);
          logger.info(
            `Saved Wallet for user ${userId}: balance=${wallet.balance}`,
          );
        } else {
          console.log(`  ⚠️  Wallet not found for user ${userId}`);
          logger.warn(`Wallet not found for user ${userId}`);
        }
      } else {
        console.log(`  ⚠️  Cannot update wallet - userId is null`);
        logger.warn(
          `Cannot update wallet for payout ${payoutId} - userId is null`,
        );
      }

      // Log the completion
      console.log(`  ✓ Payout update completed: ${payoutId}`);
      logger.info(
        `Successfully updated payout ${payoutId} to status ${internalStatus}`,
      );
    } catch (error) {
      console.error(
        `  ❌ Error updating payout ${payoutId}: ${error.message}`
      );
      logger.error(
        `Error updating payout status for ${payoutId}: ${error.message}`,
        error,
      );
    }
  }

  /**
   * Apply the balance effect of a payout based on its final status
   * Handles deductions and refunds based on payout completion status
   * @param {Object} transaction - Transaction document
   * @param {String} status - New transaction status (completed, failed, pending)
   * @param {Object} wallet - Wallet document
   */
  async applyPayoutEffect(transaction, status, wallet) {
    const amount = transaction.amount;
    const transactionId = transaction._id;
    const payoutId = transaction.pawapayPayoutId;

    try {
      if (status === "completed") {
        // Payout completed - balance should already be deducted when initiated
        // Just ensure applied flag is set
        if (!transaction.applied) {
          transaction.applied = true;
          await transaction.save();
          console.log(
            `    💰 [COMPLETED] Amount ${amount} confirmed deducted. Applied=true`
          );
          logger.info(
            `[COMPLETED] Payout ${payoutId}: Amount ${amount} confirmed deducted from wallet. Applied=true`,
          );
        } else {
          console.log(
            `    ℹ️  [COMPLETED] Already marked as applied`
          );
          logger.debug(
            `[COMPLETED] Payout ${payoutId}: Already marked as applied`,
          );
        }
      } else if (status === "failed") {
        // Payout failed - refund money back to wallet if not already refunded
        if (!transaction.applied) {
          const balanceBefore = wallet.balance;

          // Add money back to balance
          wallet.balance += amount;

          // Update the wallet transaction status to failed
          const walletTx = wallet.transactions.find(
            (tx) =>
              tx.pawapayPayoutId === payoutId ||
              tx.transactionId?.toString() === transactionId.toString(),
          );
          if (walletTx) {
            walletTx.status = "failed";
          }

          transaction.applied = true;
          await transaction.save();

          console.log(
            `    🔄 [FAILED] Refunded ${amount} back to wallet. Balance: ${balanceBefore} → ${wallet.balance}`
          );
          logger.info(
            `[FAILED] Payout ${payoutId}: Refunded ${amount} back to wallet. Balance: ${balanceBefore} → ${wallet.balance}`,
          );
        } else {
          console.log(
            `    ℹ️  [FAILED] Already marked as applied (refund already processed)`
          );
          logger.debug(
            `[FAILED] Payout ${payoutId}: Already marked as applied (refund already processed)`,
          );
        }
      } else if (status === "pending") {
        // Still pending - no balance changes
        console.log(
          `    ⏳ [PENDING] Amount ${amount} held in wallet - awaiting confirmation`
        );
        logger.debug(
          `[PENDING] Payout ${payoutId}: Amount ${amount} held in wallet - awaiting confirmation`,
        );
      }
    } catch (error) {
      console.error(
        `    ❌ Error applying payout effect: ${error.message}`
      );
      logger.error(
        `Error applying payout effect for transaction ${transactionId}: ${error.message}`,
        error,
      );
    }
  }

  /**
   * Map PawaPay payout status to internal status
   * @param {String} pawapayStatus - Status from PawaPay API
   * @returns {String} Internal status
   */
  mapPayoutStatus(pawapayStatus) {
    const statusMap = {
      COMPLETED: "completed",
      FAILED: "failed",
      EXPIRED: "failed",
      REJECTED: "failed",
      PROCESSING: "pending",
      PENDING: "pending",
      IN_PROGRESS: "pending",
    };

    return statusMap[pawapayStatus?.toUpperCase()] || "pending";
  }

  /**
   * Manually check and update a specific payout by ID
   * Useful for immediate status check requests
   * @param {String} payoutId - PawaPay payout ID
   * @returns {Object} Result of the check
   */
  async checkSpecificPayout(payoutId) {
    try {
      const transaction = await Transaction.findOne({
        pawapayPayoutId: payoutId,
      }).populate("userId", "name email mobileNumber");

      if (!transaction) {
        return {
          success: false,
          error: "Payout transaction not found",
        };
      }

      await this.updatePayoutStatus(transaction);

      // Fetch updated transaction
      const updatedTransaction = await Transaction.findById(transaction._id);

      return {
        success: true,
        message: "Payout status checked and updated",
        transaction: {
          payoutId: updatedTransaction.pawapayPayoutId,
          status: updatedTransaction.status,
          amount: updatedTransaction.amount,
          currency: updatedTransaction.currency,
          country: updatedTransaction.country,
          lastChecked: new Date(),
        },
      };
    } catch (error) {
      logger.error(`Error checking specific payout ${payoutId}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get statistics about pending payouts
   * @returns {Object} Statistics
   */
  async getPayoutStats() {
    try {
      const stats = await Transaction.aggregate([
        {
          $match: {
            type: "withdrawal",
            pawapayPayoutId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      return {
        success: true,
        stats,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error("Error fetching payout stats", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export default new PayoutMonitorService();
