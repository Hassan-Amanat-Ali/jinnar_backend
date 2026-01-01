import mongoose from "mongoose";

const lectureProgressSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },
        lectureId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lecture",
            required: true,
        },
        // Resume functionality
        currentPosition: {
            type: Number, // Seconds
            default: 0,
        },
        videoDuration: {
            type: Number, // Seconds (snapshot for analytics)
            default: 0,
        },
        watchTime: {
            type: Number, // Total seconds watched (could be > duration if replayed)
            default: 0
        },
        // Completion logic
        isCompleted: {
            type: Boolean,
            default: false,
        },
        completionPercentage: {
            type: Number,
            default: 0
        },
        completedAt: {
            type: Date
        },
        lastWatchedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// Compound index for unique progress record per user/lecture
lectureProgressSchema.index({ userId: 1, lectureId: 1 }, { unique: true });
lectureProgressSchema.index({ courseId: 1 }); // For analytics

export default mongoose.model("LectureProgress", lectureProgressSchema);
