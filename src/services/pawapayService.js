import crypto from "crypto";
import logger from "../utils/logger.js";
import { validatePhoneNumber, validateAmount } from "../utils/validators.js";
import dotenv from "dotenv";

const BASE_URL =
  process.env.PAWAPAY_BASE_URL || "https://api.pawapay.io";

class PawaPayController {
  static initialize() {
    dotenv.config();
  }

  static async predictCorrespondent(phoneNumber) {
    try {
      if (!validatePhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number format");
      }
      console.log("This is phone number:", phoneNumber);

      const url = `${BASE_URL}/v1/predict-correspondent`;
      const options = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjEyNTY2IiwibWF2IjoiMSIsImV4cCI6MjA3ODQwMzY2MCwiaWF0IjoxNzYyODcwODYwLCJwbSI6IkRBRixQQUYiLCJqdGkiOiJkZjhmMmYzMS00OGIyLTQyZDYtOTgyZS0wNjEwMzFhMDdjZmYifQ.kooJPvGIsXTFuMGdhcAE0nhErH4EWVqmYyaRclxepZsEGXXEgx543kxJy-sjGUTjC9_rx44DZHhEKo3FdwuxFg"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ msisdn: phoneNumber }),
      };

      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }
      const data = await response.json();
      console.log("Predict Correspondent Response:", data);

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error(`Predicting Correspondent Failed: ${phoneNumber}`, error);
      logger.error("Predicting Correspondent Failed", {
        phoneNumber,
        error: error.message,
      });
      return {
        success: false,
        error: error.message || "Failed to predict correspondent",
      };
    }
  }

  static async createDeposit({
    provider,
    amount,
    phoneNumber,
    orderId,
    country,
    currency,
  }) {
    try {
      if (!validatePhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number format");
      }
      if (!validateAmount(amount)) {
        throw new Error("Invalid amount");
      }
      if (!provider || !country || !currency) {
        throw new Error("Missing required parameters");
      }

      const depositId = crypto.randomUUID();
      const statementDescription = `Order ${orderId}`
        .slice(0, 22)
        .replace(/[^a-zA-Z0-9 ]/g, " ");
      if (statementDescription.length < 4) {
        throw new Error(
          "Statement description too short (must be 4-22 characters)",
        );
      }

      const body = {
        depositId,
        amount: String(amount),
        currency,
        correspondent: provider,
        payer: {
          address: { value: phoneNumber.replace(/^\+/, "") },
          type: "MSISDN",
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription,
        country,
        metadata: [
          { fieldName: "orderId", fieldValue: depositId },
          {
            fieldName: "customerId",
            fieldValue: "customer@email.com",
            isPII: true,
          },
        ],
      };

      const url = `${BASE_URL}/v1/deposits`;
      const options = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjEyNTY2IiwibWF2IjoiMSIsImV4cCI6MjA3ODQwMzY2MCwiaWF0IjoxNzYyODcwODYwLCJwbSI6IkRBRixQQUYiLCJqdGkiOiJkZjhmMmYzMS00OGIyLTQyZDYtOTgyZS0wNjEwMzFhMDdjZmYifQ.kooJPvGIsXTFuMGdhcAE0nhErH4EWVqmYyaRclxepZsEGXXEgx543kxJy-sjGUTjC9_rx44DZHhEKo3FdwuxFg"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      };

      console.log("Deposit Request:", JSON.stringify(body, null, 2));
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }
      const data = await response.json();
      console.log("Create Deposit Response:", data);

      const success = data.status !== "REJECTED";
      if (!success) {
        console.warn("Deposit rejected:", data.rejectionReason);
      }

      logger.info(`Deposit created successfully: ${depositId}`);
      return {
        success,
        data,
        depositId,
      };
    } catch (error) {
      console.error(`Deposit creation failed: ${phoneNumber}`, error);
      logger.error(`Deposit creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to create deposit",
        depositId: null,
      };
    }
  }

  static async createPayout({
    provider,
    amount,
    phoneNumber,
    withdrawId,
    country,
    currency,
  }) {
    try {
      if (!validatePhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number format");
      }
      if (!validateAmount(amount)) {
        throw new Error("Invalid amount");
      }
      if (!provider || !country || !currency) {
        console.log("Missing parameters:", { provider, country, currency });
        throw new Error("Missing required parameters");
      }

      const payoutId = crypto.randomUUID();
      const statementDescription = `Withdraw ${withdrawId}`
        .slice(0, 22)
        .replace(/[^a-zA-Z0-9 ]/g, " ");
      if (statementDescription.length < 4) {
        throw new Error(
          "Statement description too short (must be 4-22 characters)",
        );
      }

      const body = {
        payoutId,
        amount: String(amount),
        currency,
        correspondent: provider,
        recipient: {
          address: { value: phoneNumber.replace(/^\+/, "") },
          type: "MSISDN",
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription,
        country,
        metadata: [
          { fieldName: "orderId", fieldValue: withdrawId },
          {
            fieldName: "customerId",
            fieldValue: "customer@email.com",
            isPII: true,
          },
        ],
      };

      const url = `${BASE_URL}/v1/payouts`;
      const options = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjEyNTY2IiwibWF2IjoiMSIsImV4cCI6MjA3ODQwMzY2MCwiaWF0IjoxNzYyODcwODYwLCJwbSI6IkRBRixQQUYiLCJqdGkiOiJkZjhmMmYzMS00OGIyLTQyZDYtOTgyZS0wNjEwMzFhMDdjZmYifQ.kooJPvGIsXTFuMGdhcAE0nhErH4EWVqmYyaRclxepZsEGXXEgx543kxJy-sjGUTjC9_rx44DZHhEKo3FdwuxFg"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      };

      console.log("Payout Request:", JSON.stringify(body, null, 2));
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }
      const data = await response.json();
      console.log("Create Payout Response:", data);

      const success = data.status !== "REJECTED";
      if (!success) {
        console.warn("Payout rejected:", data.rejectionReason);
      }

      logger.info(`Payout created successfully: ${payoutId}`);
      return {
        success,
        data,
        payoutId,
      };
    } catch (error) {
      console.error(`Payout creation failed: ${phoneNumber}`, error);
      logger.error(`Payout creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to create payout",
        payoutId: null,
      };
    }
  }

  static async checkTransactionStatus(transactionId, type) {
    try {
      if (!transactionId || !["deposit", "payout"].includes(type)) {
        throw new Error("Invalid transaction ID or type");
      }

      const endpoint =
        type === "deposit"
          ? `/v1/deposits/${transactionId}`
          : `/v1/payouts/${transactionId}`;
      const url = `${BASE_URL}${endpoint}`;
      const options = {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjEyNTY2IiwibWF2IjoiMSIsImV4cCI6MjA3ODQwMzY2MCwiaWF0IjoxNzYyODcwODYwLCJwbSI6IkRBRixQQUYiLCJqdGkiOiJkZjhmMmYzMS00OGIyLTQyZDYtOTgyZS0wNjEwMzFhMDdjZmYifQ.kooJPvGIsXTFuMGdhcAE0nhErH4EWVqmYyaRclxepZsEGXXEgx543kxJy-sjGUTjC9_rx44DZHhEKo3FdwuxFg"}`,
        },
      };

      console.log("Check Transaction Status Request:", { url });
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }
      const data = await response.json();
      console.log("Check Transaction Status Response:", data);

      const success = Array.isArray(data) && data.length === 0 ? false : true;
      if (!success) {
        console.warn("Empty response for transaction status");
      }

      logger.info(`Transaction status checked: ${transactionId}`);
      return {
        success,
        data,
      };
    } catch (error) {
      console.error(`Transaction status check failed: ${transactionId}`, error);
      logger.error(`Transaction status check failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to check transaction status",
      };
    }
  }

  static async createRefund(depositId, amount, reason) {
    try {
      if (!depositId || !validateAmount(amount)) {
        throw new Error("Invalid deposit ID or amount");
      }
      if (!reason || reason.length > 100) {
        throw new Error(
          "Invalid reason (must be non-empty and <= 100 characters)",
        );
      }

      const refundId = crypto.randomUUID();
      const body = {
        refundId,
        depositId,
        amount: String(amount),
        reason,
        customerTimestamp: new Date().toISOString(),
      };

      const url = `${BASE_URL}/v1/refunds`;
      const options = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjEyNTY2IiwibWF2IjoiMSIsImV4cCI6MjA3ODQwMzY2MCwiaWF0IjoxNzYyODcwODYwLCJwbSI6IkRBRixQQUYiLCJqdGkiOiJkZjhmMmYzMS00OGIyLTQyZDYtOTgyZS0wNjEwMzFhMDdjZmYifQ.kooJPvGIsXTFuMGdhcAE0nhErH4EWVqmYyaRclxepZsEGXXEgx543kxJy-sjGUTjC9_rx44DZHhEKo3FdwuxFg"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      };

      console.log("Create Refund Request:", JSON.stringify(body, null, 2));
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }
      const data = await response.json();
      console.log("Create Refund Response:", data);

      const success = data.status !== "REJECTED";
      if (!success) {
        console.warn("Refund rejected:", data.rejectionReason);
      }

      logger.info(`Refund created successfully: ${refundId}`);
      return {
        success,
        data,
        refundId,
      };
    } catch (error) {
      console.error(`Refund creation failed: ${depositId}`, error);
      logger.error(`Refund creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to create refund",
        refundId: null,
      };
    }
  }

  // Get active configuration - countries and providers
  static async getActiveConfiguration(operationType = "DEPOSIT") {
    try {
      if (!["DEPOSIT", "PAYOUT"].includes(operationType)) {
        throw new Error(
          "Invalid operationType. Must be 'DEPOSIT' or 'PAYOUT'",
        );
      }

      const url = `${BASE_URL}/v2/active-conf?operationType=${operationType}`;
      const options = {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjE5NjAiLCJtYXYiOiIxIiwiZXhwIjoyMDgxNTkzODQ1LCJpYXQiOjE3NjYwNjEwNDUsInBtIjoiREFGLFBBRiIsImp0aSI6IjI4NWJjOTUxLWRhNjItNGRkYi04YzEwLWI2MTU5ZjE0YzhhYyJ9.zaRMiinyQKijuG2IHpaKCJuzMNkpyf8y_FZLRz4xR5W5I3tESJ-6KtJTYaaQQRQtLKIeU6iLAe8cH4Sn1dbqDw"}`,
          "Content-Type": "application/json",
        },
      };

      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }

      const data = await response.json();
      logger.info(
        `Active configuration fetched successfully for ${operationType}`,
      );

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error(
        `Fetching active configuration failed for ${operationType}`,
        error,
      );
      logger.error("Fetching active configuration failed", {
        operationType,
        error: error.message,
      });
      return {
        success: false,
        error: error.message || "Failed to fetch active configuration",
      };
    }
  }

  // Get payout status from PawaPay
  static async getPayoutStatus(payoutId) {
    try {
      if (!payoutId) {
        throw new Error("Payout ID is required");
      }

      const url = `${BASE_URL}/v2/payouts/${payoutId}`;
      const options = {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjEyNDAyIiwibWF2IjoiMSIsImV4cCI6MjA3OTE4NzI0OSwiaWF0IjoxNzYzNjU0NDQ5LCJwbSI6IkRBRixQQUYiLCJqdGkiOiI2OTJkZmM1Zi1hZDQ3LTRkZmEtYmE3Ny1hZjk0MGJiZmJmZTcifQ.hESvBRpDzxaBUv5QHzPOtj9ia0Ic4dfooc5XFCGbSx1ly0Wl6VWqkNpvwZ6egQnVXVtvZwLZBrgemE63AoFmIQ"}`,
          "Content-Type": "application/json",
        },
      };

      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`,
        );
      }

      const data = await response.json();
      logger.info(`Payout status fetched successfully for ${payoutId}`);

      // Return both raw response and the data object
      if (data.status === "FOUND" && data.data) {
        return {
          success: true,
          data: data.data,
        };
      } else if (data.status === "NOT_FOUND") {
        return {
          success: false,
          error: "Payout not found",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error(`Fetching payout status failed for ${payoutId}`, error);
      logger.error("Fetching payout status failed", {
        payoutId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message || "Failed to fetch payout status",
      };
    }
  }
}

export default PawaPayController;
