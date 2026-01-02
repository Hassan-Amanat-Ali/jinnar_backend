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
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "all_levels"],
      default: "beginner",
    },
    duration: {
      type: Number, // In minutes
      default: 0,
    },
    language: {
      type: String,
      default: "English",
    },
    price: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      type: String,
      default: "default-course.jpg", // TODO: Replace with generic image
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
  },
  { timestamps: true }
);

// Indexes for common queries
courseSchema.index({ category: 1, isPublished: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ price: 1 });
courseSchema.index({ rating: -1 });
courseSchema.index({ title: "text", tags: "text" }); // Text search

export default mongoose.model("Course", courseSchema);
