// import express from "express";
// import BlogController from "../controllers/blogController.js";
// import { uploadBlogImagesMW } from "../middleware/upload.js";
// import { protect, authorize } from "../middleware/auth.js";
// const router = express.Router();

// // Protect all admin blog routes with authentication and authorization middleware
// router.use(protect);
// router.use(authorize(["super_admin", "admin", "blog_manager"])); // Adjust roles as per your application's hierarchy

// // Admin Routes
// router.route("/")
//   .get(BlogController.getAdminBlogs) // Get all blogs (including drafts) for admin
//   .post(uploadBlogImagesMW, BlogController.createBlog); // Create a new blog

// router.route("/:id")
//   .get(BlogController.getBlogByIdForAdmin) // Get a single blog by ID (for editing)
//   .put(uploadBlogImagesMW, BlogController.updateBlog) // Update an existing blog
//   .delete(BlogController.deleteBlog); // Delete a blog

// export default router;