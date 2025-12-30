// routes/userRoutes.js
import express from "express";
import { findWorkers } from "../controllers/userController.js";
import { findWorkersNearYou } from "../controllers/workerController.js";
const router = express.Router();

// Public endpoint - no authentication required for landing page
router.get("/find", findWorkers);
router.get("/top-rated-nearby" ,findWorkersNearYou )

export default router;
