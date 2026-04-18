/**
 * Static FX Rate Configuration
 *
 * Rates represent: 1 USD = X local currency
 * These are approximate mid-market rates as static defaults.
 * Replace with a live FX API (e.g. Open Exchange Rates, CurrencyLayer)
 * for production accuracy.
 */

export const FX_RATES = {
  PKR: 278.5,
  KES: 129.0,
  GHS: 15.8,
  UGX: 3750.0,
  TZS: 2650.0,
  ZMW: 27.5,
  RWF: 1350.0,
  USD: 1.0,
};

export const BASE_CURRENCY = "USD";

/**
 * Decimal places used when rounding amounts in each currency.
 * USD uses 2; most African currencies use 0-2 depending on convention.
 */
export const CURRENCY_PRECISION = {
  USD: 2,
  PKR: 2,
  KES: 2,
  GHS: 2,
  UGX: 0,
  TZS: 0,
  ZMW: 2,
  RWF: 0,
};
