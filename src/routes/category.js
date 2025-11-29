import express from "express";
import {
  getAllCategories,
  getAllSubcategories,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", getAllCategories);
router.get("/subcategories", getAllSubcategories);

export default router;