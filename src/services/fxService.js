import Decimal from "decimal.js";
import axios from "axios";
import {
  FX_RATES,
  BASE_CURRENCY,
  CURRENCY_PRECISION,
} from "../config/fxRates.js";
import logger from "../utils/logger.js";

// In-memory cache
let cachedRates = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

/**
 * FXService — Foreign Exchange conversion layer.
 *
 * All wallet balances are stored in USD (BASE_CURRENCY).
 * External pawaPay transactions happen in local currencies.
 * This service handles the conversion in both directions.
 *
 * Live rates are fetched from ExchangeRate-API and cached in-memory.
 */
class FXService {
  /**
   * Clear the in-memory cache. (Mainly for testing)
   */
  static clearCache() {
    cachedRates = null;
    lastFetchTime = 0;
  }

  /**
   * Fetch live rates from API with in-memory caching.
   * @returns {Promise<Object>} Object containing rates (1 USD = X local)
   */
  static async getLiveRates() {
    const now = Date.now();

    try {
      // 1. Check in-memory cache
      if (cachedRates && (now - lastFetchTime < CACHE_TTL)) {
        return cachedRates;
      }

      // 2. Fetch from External API
      const apiKey = process.env.FX_API_KEY;
      if (!apiKey || apiKey === "your_exchangerate_api_key_here") {
        logger.warn("FX: No API key provided, using static fallback rates.");
        return FX_RATES;
      }

      const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${BASE_CURRENCY}`;
      const response = await axios.get(url);
      
      if (response.data && response.data.result === "success") {
        cachedRates = response.data.conversion_rates;
        lastFetchTime = now;
        logger.info("FX: Successfully fetched and cached live rates from API.");
        return cachedRates;
      }

      throw new Error(response.data?.["error-type"] || "Unknown API error");
    } catch (error) {
      logger.error(`FX: Live rate fetch failed: ${error.message}. Falling back to ${cachedRates ? "stale cache" : "static rates"}.`);
      return cachedRates || FX_RATES;
    }
  }

  /**
   * Convert a local currency amount to USD.
   *
   * @param {number} amount - Amount in local currency
   * @param {string} currency - ISO currency code
   * @returns {{ usdAmount: number, localAmount: number, rate: number }}
   */
  static async convertToUSD(amount, currency) {
    if (!amount || amount <= 0) {
      throw new Error("FXService: amount must be a positive number");
    }

    const upperCurrency = currency?.toUpperCase();
    const rates = await this.getLiveRates();

    // Passthrough if already USD
    if (upperCurrency === BASE_CURRENCY) {
      return {
        usdAmount: Number(new Decimal(amount).toFixed(2)),
        localAmount: Number(new Decimal(amount).toFixed(2)),
        rate: 1.0,
      };
    }

    const rate = rates[upperCurrency] || FX_RATES[upperCurrency];
    if (!rate) {
      throw new Error(`FXService: unsupported currency "${currency}"`);
    }

    const decimalAmount = new Decimal(amount);
    const decimalRate = new Decimal(rate);
    const usdAmount = decimalAmount.dividedBy(decimalRate);

    const usdPrecision = CURRENCY_PRECISION[BASE_CURRENCY] || 2;
    const localPrecision = CURRENCY_PRECISION[upperCurrency] ?? 2;

    const result = {
      usdAmount: Number(usdAmount.toFixed(usdPrecision)),
      localAmount: Number(decimalAmount.toFixed(localPrecision)),
      rate: Number(decimalRate.toFixed(6)),
    };

    logger.info(
      `FX: ${result.localAmount} ${upperCurrency} → ${result.usdAmount} USD @ rate ${result.rate}`,
    );

    return result;
  }

  /**
   * Convert a USD amount to local currency.
   *
   * @param {number} amount - Amount in USD
   * @param {string} currency - Target local currency code
   * @returns {{ localAmount: number, usdAmount: number, rate: number }}
   */
  static async convertFromUSD(amount, currency) {
    if (!amount || amount <= 0) {
      throw new Error("FXService: amount must be a positive number");
    }

    const upperCurrency = currency?.toUpperCase();
    const rates = await this.getLiveRates();

    // Passthrough if target is USD
    if (upperCurrency === BASE_CURRENCY) {
      return {
        localAmount: Number(new Decimal(amount).toFixed(2)),
        usdAmount: Number(new Decimal(amount).toFixed(2)),
        rate: 1.0,
      };
    }

    const rate = rates[upperCurrency] || FX_RATES[upperCurrency];
    if (!rate) {
      throw new Error(`FXService: unsupported currency "${currency}"`);
    }

    const decimalAmount = new Decimal(amount);
    const decimalRate = new Decimal(rate);
    const localAmount = decimalAmount.times(decimalRate);

    const usdPrecision = CURRENCY_PRECISION[BASE_CURRENCY] || 2;
    const localPrecision = CURRENCY_PRECISION[upperCurrency] ?? 2;

    const result = {
      localAmount: Number(localAmount.toFixed(localPrecision)),
      usdAmount: Number(decimalAmount.toFixed(usdPrecision)),
      rate: Number(decimalRate.toFixed(6)),
    };

    logger.info(
      `FX: ${result.usdAmount} USD → ${result.localAmount} ${upperCurrency} @ rate ${result.rate}`,
    );

    return result;
  }

  /**
   * Get the current rate for a currency pair.
   * @param {string} currency - Local currency code
   * @returns {Promise<number>} rate (1 USD = X local)
   */
  static async getRate(currency) {
    const upperCurrency = currency?.toUpperCase();
    const rates = await this.getLiveRates();
    const rate = rates[upperCurrency] || FX_RATES[upperCurrency];
    if (!rate) {
      throw new Error(`FXService: unsupported currency "${currency}"`);
    }
    return rate;
  }

  /**
   * Check if a currency is supported.
   * @param {string} currency
   * @returns {Promise<boolean>}
   */
  static async isSupported(currency) {
    const rates = await this.getLiveRates();
    return !!(rates[currency?.toUpperCase()] || FX_RATES[currency?.toUpperCase()]);
  }
}

export default FXService;
