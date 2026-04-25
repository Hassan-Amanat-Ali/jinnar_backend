import express from "express";
import { BASE_CURRENCY, CURRENCY_PRECISION } from "../config/fxRates.js";
import FXService from "../services/fxService.js";

const router = express.Router();

/**
 * @route   GET /api/fx/rates
 * @desc    Get all supported FX rates, base currency, and precisions
 * @access  Public
 */
router.get("/rates", async (req, res) => {
  try {
    const rates = await FXService.getLiveRates();
    res.json({
      success: true,
      data: {
        baseCurrency: BASE_CURRENCY,
        rates: rates,
        precisions: CURRENCY_PRECISION
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch exchange rates",
      error: error.message
    });
  }
});

export default router;
