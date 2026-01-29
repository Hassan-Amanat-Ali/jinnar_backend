import Course from "../models/Course.js";
import Lecture from "../models/Lecture.js";
import CourseCategory from "../models/CourseCategory.js";

class AdminCourseController {
  // ===========================================================================
  // COURSE MANAGEMENT
  // ===========================================================================

  static async createCourse(req, res) {
    try {
      const {
        title,
        description,
        category,
        price,
        discountPrice,
        level,
        thumbnail,
        tags,
        syllabus,
        requirements,
        learningOutcomes,
        detailedDescription,
        highlights,
        language,
        courseType,
        pdfUrl,
        outlines,
        totalOutlines,
        published,
        enrollmentLimit,
      } = req.body;

      // Basic validation
      if (!title || !description || !category) {
        return res
          .status(400)
          .json({ error: "Title, description, and category are required." });
      }

      if (courseType === "pdf" && !pdfUrl) {
        return res
          .status(400)
          .json({ error: "PDF URL is required for PDF courses." });
      }

      const courseData = {
        title,
        description,
        detailedDescription: detailedDescription || description,
        highlights: highlights || "",
        category,
        instructor: req.user.id,
        price: price || 0,
        discountPrice: discountPrice || 0,
        level: level || "Beginner",
        thumbnail: thumbnail || "default-course.jpg",
        tags: tags || [],
        syllabus: syllabus || [],
        requirements: requirements || [],
        learningOutcomes: learningOutcomes || [],
        language: language || "English",
        courseType: courseType || "video",
        pdfUrl: courseType === "pdf" ? pdfUrl : undefined,
        outlines: courseType === "pdf" ? outlines || [] : [],
        totalOutlines: courseType === "pdf" ? totalOutlines || 0 : 0,
        published: published || false,
        isPublished: published || false,
        enrollmentLimit: enrollmentLimit || 0,
      };

      const course = await Course.create(courseData);

      res.status(201).json({ message: "Course created successfully", course });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCourse(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Handle dual publish field consistency
      if (updates.published !== undefined) {
        updates.isPublished = updates.published;
      } else if (updates.isPublished !== undefined) {
        updates.published = updates.isPublished;
      }

      const course = await Course.findByIdAndUpdate(id, updates, { new: true });

      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      res.json({ message: "Course updated successfully", course });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteCourse(req, res) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Delete associated lectures
      await Lecture.deleteMany({ courseId: id });
      await Course.findByIdAndDelete(id);

      res.json({ message: "Course and related lectures deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllCoursesAdmin(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const filter = {};
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
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getCourseById(req, res) {
    try {
      const { id } = req.params;
      const course = await Course.findById(id)
        .populate("category", "name")
        .populate("instructor", "name email");

      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Also fetch lectures
      const lectures = await Lecture.find({ courseId: id }).sort({ order: 1 });

      res.json({ course, lectures });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===========================================================================
  // LECTURE MANAGEMENT
  // ===========================================================================

  static async addLecture(req, res) {
    try {
      const { id } = req.params; // Course ID
      const {
        title,
        subtitle,
        videoUrl,
        thumbnail,
        duration,
        order,
        description,
        resources,
        learningPoints,
        isPreview,
      } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Auto-assign order if not provided
      let lectureOrder = order;
      if (lectureOrder === undefined) {
        const lastLecture = await Lecture.findOne({ courseId: id }).sort({
          order: -1,
        });
        lectureOrder = lastLecture ? lastLecture.order + 1 : 1;
      }

      const lecture = await Lecture.create({
        courseId: id,
        title,
        subtitle,
        videoUrl,
        thumbnail,
        duration: duration || "0:00",
        order: lectureOrder,
        description,
        resources: resources || [],
        learningPoints: learningPoints || [],
        isPreview: isPreview || false,
      });

      res.status(201).json({ message: "Lecture added successfully", lecture });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateLecture(req, res) {
    try {
      const { id } = req.params; // Lecture ID
      const updates = req.body;

      const lecture = await Lecture.findByIdAndUpdate(id, updates, {
        new: true,
      });
      if (!lecture) {
        return res.status(404).json({ error: "Lecture not found" });
      }

      res.json({ message: "Lecture updated successfully", lecture });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteLecture(req, res) {
    try {
      const { id } = req.params; // Lecture ID

      const lecture = await Lecture.findByIdAndDelete(id);
      if (!lecture) {
        return res.status(404).json({ error: "Lecture not found" });
      }

      // Update course duration
      const allLectures = await Lecture.find({ courseId: lecture.courseId });
      const totalDuration = allLectures.reduce(
        (sum, l) => sum + (l.duration || 0),
        0,
      );
      await Course.findByIdAndUpdate(lecture.courseId, {
        duration: totalDuration,
      });

      res.json({ message: "Lecture deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===========================================================================
  // COURSE CATEGORY MANAGEMENT
  // ===========================================================================

  static async createCourseCategory(req, res) {
    try {
      const { name } = req.body;
      if (!name)
        return res.status(400).json({ error: "Category name is required" });

      const category = await CourseCategory.create({ name });
      res.status(201).json({ message: "Course category created", category });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ error: "Category already exists" });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllCourseCategories(req, res) {
    try {
      const categories = await CourseCategory.find({ isActive: true }).sort(
        "name",
      );
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCourseCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, isActive } = req.body;

      const category = await CourseCategory.findByIdAndUpdate(
        id,
        { name, isActive },
        { new: true, runValidators: true },
      );

      if (!category)
        return res.status(404).json({ error: "Category not found" });
      res.json({ message: "Category updated", category });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteCourseCategory(req, res) {
    try {
      const { id } = req.params;
      // Check if used in any course
      const count = await Course.countDocuments({ category: id });
      if (count > 0) {
        return res
          .status(400)
          .json({ error: "Cannot delete category used by existing courses" });
      }

      const category = await CourseCategory.findByIdAndDelete(id);
      if (!category)
        return res.status(404).json({ error: "Category not found" });

      res.json({ message: "Category deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default AdminCourseController;
