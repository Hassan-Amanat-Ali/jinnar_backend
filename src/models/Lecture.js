import mongoose from "mongoose";

const lectureSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Lecture title is required"],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    videoUrl: {
      type: String,
      required: [true, "Video URL is required"],
    },
    thumbnail: {
      type: String,
    },
    duration: {
      type: String, // String to support "12:30"
      default: "0:00",
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
    },
    resources: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
      },
    ],
    learningPoints: [
      {
        text: String,
        timestamp: String,
      },
    ],
    isPreview: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

lectureSchema.index({ courseId: 1, order: 1 });

export default mongoose.model("Lecture", lectureSchema);
