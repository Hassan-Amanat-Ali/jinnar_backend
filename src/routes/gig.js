import express from "express";
import {
  searchGigs,
  getGigById,
  createGig,
  getAllGigs,
  getMyGigs,
  deleteGig,
  updateGig,
} from "../controllers/gigController.js";
import { protect } from "../middleware/auth.js";
import { uploadGigImageMW, uploadGigImagesMW } from "../middleware/upload.js";

const router = express.Router();

router.get("/search", searchGigs);
router.post("/create", protect, ...uploadGigImagesMW, createGig);
router.get("/", getAllGigs);

router.get("/my-gigs", protect, getMyGigs);

router.get("/:id", getGigById);

router.put("/update/:id", protect, ...uploadGigImageMW, updateGig);
router.delete("/delete/:id", protect, deleteGig);

export default router;
