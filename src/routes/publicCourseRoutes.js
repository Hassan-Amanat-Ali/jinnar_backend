import express from "express";
import { protect } from "../middleware/auth.js";
import Course from "../models/Course.js";
import Lecture from "../models/Lecture.js";
import CourseCategory from "../models/CourseCategory.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/courses
 * @desc    Get all published courses (public for authenticated users)
 * @access  Private (any authenticated user)
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter - only published courses
    const filter = {
      $or: [{ isPublished: true }, { published: true }],
    };

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.courseType) {
      filter.courseType = req.query.courseType;
    }

    const courses = await Course.find(filter)
      .populate("category", "name")
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Course.countDocuments(filter);

    res.json({
      courses,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/courses/categories
 * @desc    Get all active course categories
 * @access  Private (any authenticated user)
 */
router.get("/categories", async (req, res) => {
  try {
    const categories = await CourseCategory.find({ isActive: true }).sort(
      "name",
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/courses/:id
 * @desc    Get course by ID with lectures and metadata
 * @access  Private (any authenticated user)
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id)
      .populate("category", "name")
      .populate("instructor", "name email");

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Only return published courses to non-admin users
    const isPublished = course.isPublished || course.published;
    if (
      !isPublished &&
      req.user.role !== "super_admin" &&
      req.user.role !== "supervisor"
    ) {
      return res
        .status(403)
        .json({ error: "This course is not published yet" });
    }

    // Fetch lectures
    const lectures = await Lecture.find({ courseId: id }).sort({ order: 1 });

    // Calculate metadata for frontend optimization
    const totalLearningPoints = lectures.reduce(
      (sum, l) => sum + (l.learningPoints?.length || 0),
      0,
    );

    res.json({
      course,
      lectures,
      metadata: {
        lectureCount: lectures.length,
        totalLearningPoints,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
