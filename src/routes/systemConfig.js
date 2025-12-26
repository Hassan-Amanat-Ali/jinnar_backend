import express from "express";
import { 
  getSystemConfig, 
  updateSystemConfig 
} from "../controllers/systemConfigController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public: Get config (useful for frontend to know maintenance mode, currency, etc.)
router.get("/", getSystemConfig);

// Admin: Update config
router.put("/", protect, authorize("super_admin", "supervisor"), updateSystemConfig);

export default router;
