import express from "express";
import { FX_RATES, BASE_CURRENCY, CURRENCY_PRECISION } from "../config/fxRates.js";

const router = express.Router();

/**
 * @route   GET /api/fx/rates
 * @desc    Get all supported FX rates, base currency, and precisions
 * @access  Public
 */
router.get("/rates", (req, res) => {
  res.json({
    success: true,
    data: {
      baseCurrency: BASE_CURRENCY,
      rates: FX_RATES,
      precisions: CURRENCY_PRECISION
    }
  });
});

export default router;
