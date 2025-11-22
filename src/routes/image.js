import express from "express";
import { uploadImages } from "../controllers/imageController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Upload images (protected route)
router.post("/upload", protect, uploadImages);

export default router;
