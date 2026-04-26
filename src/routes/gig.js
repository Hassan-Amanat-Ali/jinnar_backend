import express from "express";
import {
  searchGigs,
  getGigById,
  getGigByPermalink,
  createGig,
  getAllGigs,
  getMyGigs,
  deleteGig,
  updateGig,
  getGigBySlug,
} from "../controllers/gigController.js";
import { protect } from "../middleware/auth.js";
import { uploadGigImageMW, uploadGigImagesMW } from "../middleware/upload.js";

const router = express.Router();

router.get("/search", searchGigs);
router.get("/permalink/:countrySlug/:serviceSlug", getGigByPermalink);
router.post("/create", protect, ...uploadGigImagesMW, createGig);
router.get("/", getAllGigs);

router.get("/my-gigs", protect, getMyGigs);

router.get("/slug/:slug", getGigBySlug);
router.get("/:id", getGigById);

router.put("/update/:id", protect, ...uploadGigImageMW, updateGig);
router.delete("/delete/:id", protect, deleteGig);

export default router;
