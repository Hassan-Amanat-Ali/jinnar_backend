// routes/userRoutes.js
import express from "express";
import { findWorkers } from "../controllers/userController.js";

const router = express.Router();

// Public endpoint - no authentication required for landing page
router.get("/find", findWorkers);

export default router;
