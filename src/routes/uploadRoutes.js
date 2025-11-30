import express from "express";
import {
  uploadProfilePicture,
  uploadOtherImages,
  uploadPortfolioImages,
  uploadGigImages,
  uploadVideos,
  uploadCertificates,
  uploadIdentityDocument,
} from "../controllers/uploadController.js";

import {
  uploadProfilePictureMW,
  uploadOtherImagesMW,
  uploadPortfolioImagesMW,
  uploadGigImagesMW, // Import the new middleware
  uploadVideosMW,
  uploadCertificatesMW,
  uploadIdentityDocumentMW,
} from "../middleware/upload.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

// 🧩 Combine middleware + controller cleanly
router.post(
  "/profile-picture",
  protect,
  ...uploadProfilePictureMW,
  uploadProfilePicture,
);
router.post(
  "/other-images",
  protect,
  ...uploadOtherImagesMW,
  uploadOtherImages,
);
router.post(
  "/portfolio",
  protect,
  ...uploadPortfolioImagesMW,
  uploadPortfolioImages,
);
router.post("/videos", protect, ...uploadVideosMW, uploadVideos);

// --- NEW: Gig Image Upload ---
router.post(
  "/gig-image/:gigId",
  protect,
  ...uploadGigImagesMW, // Use the new, correct middleware
  uploadGigImages,
);
router.post(
  "/certificates",
  protect,
  ...uploadCertificatesMW,
  uploadCertificates,
);

// --- NEW: Identity Document Upload ---
router.post(
  "/identity-document",
  protect,
  ...uploadIdentityDocumentMW,
  uploadIdentityDocument
);

export default router;
