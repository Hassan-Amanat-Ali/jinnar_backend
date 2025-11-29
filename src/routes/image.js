import express from "express";
import { protect } from "../middleware/auth.js";
import { uploadOtherImagesMW } from "../middleware/upload.js";
import { uploadOtherImages } from "../controllers/uploadController.js";

const router = express.Router();

// This route is maintained for backward compatibility.
// It now uses the same local storage upload mechanism as the rest of the application.
router.post(
  "/upload",
  protect,
  ...uploadOtherImagesMW, // Uses the new local storage middleware
  uploadOtherImages, // Uses the new local storage controller
);

export default router;
