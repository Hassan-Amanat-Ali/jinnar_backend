import express from "express";
import {
  uploadProfilePicture,
  uploadOtherImages,
  uploadPortfolioImages,
  uploadVideos,
  uploadCertificates,
  uploadGigImage,
} from "../controllers/uploadController.js";

import {
  uploadProfilePictureMW,
  uploadOtherImagesMW,
  uploadPortfolioImagesMW,
  uploadVideosMW,
  uploadCertificatesMW,
  uploadGigImageMW,
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
router.post(
  "/certificates",
  protect,
  ...uploadCertificatesMW,
  uploadCertificates,
);
router.post("/gig-image", protect, ...uploadGigImageMW, uploadGigImage);

export default router;
