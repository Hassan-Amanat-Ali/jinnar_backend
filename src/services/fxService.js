import Decimal from "decimal.js";
import {
  FX_RATES,
  BASE_CURRENCY,
  CURRENCY_PRECISION,
} from "../config/fxRates.js";
import logger from "../utils/logger.js";

/**
 * FXService — Foreign Exchange conversion layer.
 *
 * All wallet balances are stored in USD (BASE_CURRENCY).
 * External pawaPay transactions happen in local currencies.
 * This service handles the conversion in both directions.
 *
 * IMPORTANT: FX rate is locked at the time of the request and stored
 * in the Transaction record. Callbacks must NEVER re-convert; they
 * use the stored USD amount.
 */
class FXService {
  /**
   * Convert a local currency amount to USD.
   * Used during DEPOSIT flow: user pays in local → we store USD.
   *
   * @param {number} amount - Amount in local currency
   * @param {string} currency - ISO currency code (e.g. "KES", "PKR")
   * @returns {{ usdAmount: number, localAmount: number, rate: number }}
   */
  static async convertToUSD(amount, currency) {
    if (!amount || amount <= 0) {
      throw new Error("FXService: amount must be a positive number");
    }

    const upperCurrency = currency?.toUpperCase();

    // Passthrough if already USD
    if (upperCurrency === BASE_CURRENCY) {
      return {
        usdAmount: Number(new Decimal(amount).toFixed(2)),
        localAmount: Number(new Decimal(amount).toFixed(2)),
        rate: 1.0,
      };
    }

    const rate = FX_RATES[upperCurrency];
    if (!rate) {
      throw new Error(`FXService: unsupported currency "${currency}"`);
    }

    // 1 USD = <rate> local → usdAmount = localAmount / rate
    const decimalAmount = new Decimal(amount);
    const decimalRate = new Decimal(rate);
    const usdAmount = decimalAmount.dividedBy(decimalRate);

    const usdPrecision = CURRENCY_PRECISION[BASE_CURRENCY] || 2;
    const localPrecision = CURRENCY_PRECISION[upperCurrency] ?? 2;

    const result = {
      usdAmount: Number(usdAmount.toFixed(usdPrecision)),
      localAmount: Number(decimalAmount.toFixed(localPrecision)),
      rate: rate,
    };

    logger.info(
      `FX: ${result.localAmount} ${upperCurrency} → ${result.usdAmount} USD @ rate ${rate}`,
    );

    return result;
  }

  /**
   * Convert a USD amount to local currency.
   * Used during PAYOUT flow: user requests USD withdrawal → we send local.
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

    // Passthrough if target is USD
    if (upperCurrency === BASE_CURRENCY) {
      return {
        localAmount: Number(new Decimal(amount).toFixed(2)),
        usdAmount: Number(new Decimal(amount).toFixed(2)),
        rate: 1.0,
      };
    }

    const rate = FX_RATES[upperCurrency];
    if (!rate) {
      throw new Error(`FXService: unsupported currency "${currency}"`);
    }

    // 1 USD = <rate> local → localAmount = usdAmount * rate
    const decimalAmount = new Decimal(amount);
    const decimalRate = new Decimal(rate);
    const localAmount = decimalAmount.times(decimalRate);

    const usdPrecision = CURRENCY_PRECISION[BASE_CURRENCY] || 2;
    const localPrecision = CURRENCY_PRECISION[upperCurrency] ?? 2;

    const result = {
      localAmount: Number(localAmount.toFixed(localPrecision)),
      usdAmount: Number(decimalAmount.toFixed(usdPrecision)),
      rate: rate,
    };

    logger.info(
      `FX: ${result.usdAmount} USD → ${result.localAmount} ${upperCurrency} @ rate ${rate}`,
    );

    return result;
  }

  /**
   * Get the current rate for a currency pair.
   * @param {string} currency - Local currency code
   * @returns {number} rate (1 USD = X local)
   */
  static getRate(currency) {
    const upperCurrency = currency?.toUpperCase();
    const rate = FX_RATES[upperCurrency];
    if (!rate) {
      throw new Error(`FXService: unsupported currency "${currency}"`);
    }
    return rate;
  }

  /**
   * Check if a currency is supported.
   * @param {string} currency
   * @returns {boolean}
   */
  static isSupported(currency) {
    return !!FX_RATES[currency?.toUpperCase()];
  }
}

export default FXService;
