import agenda from "../config/agenda.js";
import FXService from "../services/fxService.js";
import logger from "../utils/logger.js";

export const defineFXJobs = () => {
  agenda.define("refresh-fx-rates", async (job) => {
    logger.info("🔄 [JOB] Starting FX rates background refresh...");
    try {
      // Calling getLiveRates() will trigger a fresh fetch if we force it 
      // or if the cache is expired. 
      // To ensure a background refresh always hits the API, we could 
      // add a force parameter to getLiveRates, but for now, 
      // it will at least ensure the cache is warm for users.
      await FXService.getLiveRates();
      logger.info("✅ [JOB] FX rates background refresh completed.");
    } catch (error) {
      logger.error(`❌ [JOB] FX rates refresh failed: ${error.message}`);
    }
  });
};
