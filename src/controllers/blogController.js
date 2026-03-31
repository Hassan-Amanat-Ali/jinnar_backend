import Blog from "../models/Blog.js";
import asyncHandler from "express-async-handler";
import { validationResult } from "express-validator";

class BlogController {
  // @desc    Get all blogs (public)
  // @route   GET /api/blogs
  // @access  Public
  static getBlogs = asyncHandler(async (req, res) => {
    const pageSize = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;

    const keyword = req.query.search
      ? {
          $or: [
            { title: { $regex: req.query.search, $options: "i" } },
            { tags: { $in: [new RegExp(req.query.search, "i")] } },
          ],
        }
      : {};

    const tagFilter = req.query.tag ? { tags: req.query.tag } : {};

    // Public only sees published blogs
    const query = { ...keyword, ...tagFilter, status: "published" };

    const count = await Blog.countDocuments(query);
    const blogs = await Blog.find(query)
      .populate("author", "name email")
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({
      blogs,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  });

  // @desc    Get blog by slug (public)
  // @route   GET /api/blogs/:slug
  // @access  Public
  static getBlogBySlug = asyncHandler(async (req, res) => {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      status: "published",
    }).populate("author", "name email");

    if (blog) {
      res.json(blog);
    } else {
      res.status(404);
      throw new Error("Blog not found");
    }
  });

  // @desc    Create a blog (admin)
  // @route   POST /api/admin/blogs
  // @access  Private/Admin
  static createBlog = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const {
      title,
      content,
      excerpt,
      featuredImage,
      tags,
      metaTitle,
      metaDescription,
      status,
      slug,
    } = req.body;

    // Check if slug is unique if provided
    if (slug) {
      const slugExists = await Blog.findOne({ slug });
      if (slugExists) {
        res.status(400);
        throw new Error("Slug already exists");
      }
    }

    const blog = new Blog({
      title,
      content,
      excerpt,
      featuredImage,
      tags,
      metaTitle,
      metaDescription,
      status,
      slug: slug || undefined, // undefined will trigger pre-save hook
      author: req.user._id, // Assume req.user is set by auth middleware
    });

    const createdBlog = await blog.save();
    res.status(201).json(createdBlog);
  });

   // @desc    Get single blog by ID (admin - including drafts)
  // @route   GET /api/admin/blogs/:id
  // @access  Private/Admin
  static getBlogByIdForAdmin = asyncHandler(async (req, res) => {
    const blog = await Blog.findById(req.params.id)
      .populate("author", "name email");

    if (blog) {
      res.json(blog);
    } else {
      res.status(404);
      throw new Error("Blog not found");
    }
  });

  // @desc    Update a blog (admin)
  // @route   PUT /api/admin/blogs/:id
  // @access  Private/Admin
  static updateBlog = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const {
      title,
      content,
      excerpt,
      featuredImage,
      tags,
      metaTitle,
      metaDescription,
      status,
      slug,
    } = req.body;

    const blog = await Blog.findById(req.params.id);

    if (blog) {
      // Check if new slug exists
      if (slug && slug !== blog.slug) {
        const slugExists = await Blog.findOne({ slug });
        if (slugExists) {
          res.status(400);
          throw new Error("Slug already exists");
        }
      }

      blog.title = title || blog.title;
      blog.content = content || blog.content;
      blog.excerpt = excerpt || blog.excerpt;
      blog.featuredImage = featuredImage || blog.featuredImage;
      blog.tags = tags || blog.tags;
      blog.metaTitle = metaTitle || blog.metaTitle;
      blog.metaDescription = metaDescription || blog.metaDescription;
      blog.status = status || blog.status;
      blog.slug = slug || blog.slug;

      const updatedBlog = await blog.save();
      res.json(updatedBlog);
    } else {
      res.status(404);
      throw new Error("Blog not found");
    }
  });

  // @desc    Delete a blog (admin)
  // @route   DELETE /api/admin/blogs/:id
  // @access  Private/Admin
  static deleteBlog = asyncHandler(async (req, res) => {
    const blog = await Blog.findById(req.params.id);

    if (blog) {
      await blog.deleteOne();
      res.json({ message: "Blog removed" });
    } else {
      res.status(404);
      throw new Error("Blog not found");
    }
  });

  // @desc    Get all blogs (admin - including drafts)
  // @route   GET /api/admin/blogs
  // @access  Private/Admin
  static getAdminBlogs = asyncHandler(async (req, res) => {
    const pageSize = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;

    const count = await Blog.countDocuments();
    const blogs = await Blog.find()
      .populate("author", "name email")
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({
      blogs,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  });
}

export default BlogController;
