import express from "express";
import BlogController from "../controllers/blogController.js";

const router = express.Router();

// Public Routes
router.get("/", BlogController.getBlogs);
router.get("/related/:slug", BlogController.getRelatedBlogs);
router.get("/:slug", BlogController.getBlogBySlug);

export default router;
