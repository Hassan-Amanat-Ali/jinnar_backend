import Blog from "../models/Blog.js";
import asyncHandler from "express-async-handler";
import { validationResult } from "express-validator";
import { buildBlogPermalink, toSlug } from "../utils/permalink.js";

const resolveBlogSlug = (blog) => toSlug(blog.slug || blog.title, "post");

const withPermalink = (blog) => ({
  ...blog,
  permalink: buildBlogPermalink(resolveBlogSlug(blog)),
});

class BlogController {
  // @desc    Get all blogs (public)
  // @route   GET /api/blogs
  // @access  Public
  static getBlogs = asyncHandler(async (req, res) => {
    const pageSize = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = pageSize * (page - 1);

    const query = { status: "published" };

    // Use text search for performance if keyword exists
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    if (req.query.tag) {
      query.tags = req.query.tag;
    }

    const count = await Blog.countDocuments(query);
    const blogs = await Blog.find(query)
      .populate("author", "name email")
      .sort({ createdAt: -1 }) // Supports { status: 1, createdAt: -1 } index
      .limit(pageSize)
      .skip(skip)
      .allowDiskUse(); // Fallback for large sorts that skip index (e.g. during text search)

    res.json({
      blogs: blogs.map((blog) => withPermalink(blog.toObject())),
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  });

  // @desc    Get blog by slug (public)
  // @route   GET /api/blogs/:slug
  // @access  Public
  static getBlogBySlug = asyncHandler(async (req, res) => {
    const requestedSlug = toSlug(req.params.slug, "post");
    let blog = await Blog.findOne({
      slug: requestedSlug,
      status: "published",
    }).populate("author", "name email");

    let redirected = false;
    if (!blog) {
      blog = await Blog.findOne({
        slugAliases: requestedSlug,
        status: "published",
      }).populate("author", "name email");
      redirected = Boolean(blog);
    }

    if (blog) {
      const payload = withPermalink(blog.toObject());
      res.json({
        ...payload,
        redirected,
      });
    } else {
      res.status(404);
      throw new Error("Blog not found");
    }
  });

  // @desc    Get related blogs by slug
  // @route   GET /api/blogs/related/:slug
  // @access  Public
  static getRelatedBlogs = asyncHandler(async (req, res) => {
    const requestedSlug = toSlug(req.params.slug, "post");

    // Find the current blog first to get its tags
    const blog = await Blog.findOne({
      $or: [{ slug: requestedSlug }, { slugAliases: requestedSlug }],
      status: "published",
    });

    if (!blog) {
      res.status(404);
      throw new Error("Blog not found");
    }

    // Find other blogs that share at least one tag
    const relatedBlogs = await Blog.find({
      _id: { $ne: blog._id },
      status: "published",
      tags: { $in: blog.tags },
    })
      .populate("author", "name email")
      .limit(3)
      .sort({ createdAt: -1 });

    res.json(relatedBlogs.map((b) => withPermalink(b.toObject())));
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
      featuredImage: featuredImageInput,
      images: imagesInput,
      tags,
      metaTitle,
      metaDescription,
      status,
      slug,
    } = req.body;

    // Handle images: filter out base64 and merge with uploaded files
    let images = [];
    if (imagesInput) {
      const parsedImages = Array.isArray(imagesInput) ? imagesInput : [imagesInput];
      images = parsedImages.filter(img => typeof img === "string" && !img.startsWith("data:image"));
    }
    if (req.files && req.files.length > 0) {
      const uploadedUrls = req.files.map(f => f.url);
      images = [...images, ...uploadedUrls];
    }

    // featuredImage fallback to first image if not provided as a valid URL
    const featuredImage = featuredImageInput && !featuredImageInput.startsWith("data:image") 
      ? featuredImageInput 
      : (images[0] || null);

    const normalizedSlug = slug ? toSlug(slug, "post") : toSlug(title, "post");

    if (slug && normalizedSlug) {
      const slugExists = await Blog.findOne({ slug: normalizedSlug });
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
      images,
      tags,
      metaTitle,
      metaDescription,
      status,
      slug: normalizedSlug,
      author: req.user._id,
    });

    const createdBlog = await blog.save();
    res.status(201).json(withPermalink(createdBlog.toObject()));
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
      featuredImage: featuredImageInput,
      images: imagesInput,
      tags,
      metaTitle,
      metaDescription,
      status,
      slug,
    } = req.body;

    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      res.status(404);
      throw new Error("Blog not found");
    }

    // Handle images: filter out base64 and merge with uploaded files
    let images = [];
    if (imagesInput) {
      const parsedImages = Array.isArray(imagesInput) ? imagesInput : [imagesInput];
      images = parsedImages.filter(img => typeof img === "string" && !img.startsWith("data:image"));
    }
    if (req.files && req.files.length > 0) {
      const uploadedUrls = req.files.map(f => f.url);
      images = [...images, ...uploadedUrls];
    }

    const normalizedSlug = slug ? toSlug(slug, "post") : undefined;

    if (normalizedSlug && normalizedSlug !== blog.slug) {
      const slugExists = await Blog.findOne({ slug: normalizedSlug });
      if (slugExists) {
        res.status(400);
        throw new Error("Slug already exists");
      }
      blog.slugAliases = [...new Set([...(blog.slugAliases || []), blog.slug])];
    }

    if (!normalizedSlug && title && title !== blog.title) {
      const regeneratedSlug = toSlug(title, "post");
      if (regeneratedSlug !== blog.slug) {
        blog.slugAliases = [...new Set([...(blog.slugAliases || []), blog.slug])];
        blog.slug = regeneratedSlug;
      }
    }

    blog.title = title || blog.title;
    blog.content = content || blog.content;
    blog.excerpt = excerpt || blog.excerpt;
    blog.tags = tags || blog.tags;
    blog.metaTitle = metaTitle || blog.metaTitle;
    blog.metaDescription = metaDescription || blog.metaDescription;
    blog.status = status || blog.status;
    blog.slug = normalizedSlug || blog.slug;
    
    // Update images if provided or uploaded
    if (imagesInput || (req.files && req.files.length > 0)) {
      blog.images = images;
    }

    // Update featuredImage if provided and NOT base64
    if (featuredImageInput && !featuredImageInput.startsWith("data:image")) {
      blog.featuredImage = featuredImageInput;
    } else if (!blog.featuredImage && blog.images.length > 0) {
      blog.featuredImage = blog.images[0];
    }

    const updatedBlog = await blog.save();
    res.json(withPermalink(updatedBlog.toObject()));
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
    const skip = pageSize * (page - 1);

    const count = await Blog.countDocuments();
    const blogs = await Blog.find()
      .populate("author", "name email")
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(skip)
      .allowDiskUse();

    res.json({
      blogs,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  });
}

export default BlogController;
