import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    detailedDescription: {
      type: String, // Markdown supported
    },
    highlights: [{ type: String }],
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseCategory",
      required: true,
    },
    courseType: {
      type: String,
      enum: ["video", "pdf"],
      default: "video",
    },
    pdfUrl: {
      type: String, // Path to the uploaded PDF file
    },
    outlines: [
      {
        title: String,
        pageNumber: Number,
      },
    ],
    totalOutlines: {
      type: Number,
      default: 0,
    },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "all_levels"],
      default: "Beginner",
    },
    duration: {
      type: String, // String to support "12 hours" or "12:30"
      default: "0",
    },
    language: {
      type: String,
      default: "English",
    },
    price: {
      type: Number,
      default: 0,
    },
    discountPrice: {
      type: Number,
      default: 0,
    },
    enrollmentLimit: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      type: String,
      default: "default-course.jpg",
    },
    tags: [{ type: String, trim: true }],
    syllabus: [
      {
        title: String,
        description: String,
        order: Number,
      },
    ],
    requirements: [{ type: String }],
    learningOutcomes: [{ type: String }],
    isPublished: {
      type: Boolean,
      default: false,
    },
    published: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    enrollmentCount: {
      type: Number,
      default: 0,
    },
    totalEnrollments: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Indexes for common queries
courseSchema.index({ category: 1, isPublished: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ price: 1 });
courseSchema.index({ rating: -1 });
courseSchema.index({ title: "text", tags: "text" }); // Text search

export default mongoose.model("Course", courseSchema);
